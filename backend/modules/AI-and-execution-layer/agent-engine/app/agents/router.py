import asyncio
from datetime import datetime, timezone

from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from . import prompts, store
from .mcp_client import list_tools_as_anthropic_schema, mcp_session
from .planner import design_team
from .prompts import PromptDef
from .runner import build_graph
from .schemas import RunRequest, RunResult, RunStatus

router = APIRouter(tags=["agents"])


class UpdatePromptRequest(BaseModel):
    value: str


@router.get("/prompts")
async def list_prompts() -> list[PromptDef]:
    return prompts.list_all()


@router.put("/prompts/{key}")
async def update_prompt(key: str, payload: UpdatePromptRequest) -> PromptDef:
    try:
        return prompts.update(key, payload.value)
    except KeyError:
        raise HTTPException(404, f'Prompt "{key}" wurde nicht gefunden.')


@router.post("/runs", status_code=202)
async def create_run(payload: RunRequest) -> RunResult:
    if not settings.anthropic_api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY ist nicht gesetzt — agent-engine kann noch nicht laufen.")

    run = RunResult(task=payload.task)
    store.save(run)
    asyncio.create_task(_execute_run(run.id))
    return run


@router.get("/runs")
async def list_runs() -> list[RunResult]:
    return store.list_all()


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> RunResult:
    run = store.get(run_id)
    if not run:
        raise HTTPException(404, f'Lauf "{run_id}" wurde nicht gefunden.')
    return run


async def _execute_run(run_id: str) -> None:
    """Runs in the background, updating the stored `RunResult` in place
    (team as soon as the planner designs it, then each step as its own
    agent finishes) so `GET /runs/{id}` reflects live progress, not just
    the final outcome — what makes a "running" entry in the AI Agents UI
    actually show as *active* rather than just pending.
    """
    run = store.get(run_id)
    if not run:
        return

    try:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        team = await design_team(client, settings.anthropic_model, run.task)
        run.team = team
        run.updated_at = datetime.now(timezone.utc)

        async with mcp_session(settings.actions_engine_mcp_url) as session:
            tools = await list_tools_as_anthropic_schema(session)
            graph = build_graph(team, client, settings.anthropic_model, session, tools)
            async for update in graph.astream(
                {"task": run.task, "steps": [], "last_output": None}, stream_mode="updates"
            ):
                for state_update in update.values():
                    new_steps = state_update.get("steps")
                    if new_steps:
                        run.steps = new_steps
                        run.updated_at = datetime.now(timezone.utc)

        run.status = RunStatus.succeeded
        run.final_answer = run.steps[-1].output if run.steps else ""
    except Exception as error:  # noqa: BLE001 — a run's own failure must not crash the process, it belongs on the run itself
        run.status = RunStatus.failed
        run.error = str(error)
    finally:
        run.updated_at = datetime.now(timezone.utc)
