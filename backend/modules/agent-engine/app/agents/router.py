from anthropic import AsyncAnthropic
from fastapi import APIRouter, HTTPException

from ..config import settings
from .mcp_client import list_tools_as_anthropic_schema, mcp_session
from .planner import design_team
from .runner import build_graph
from .schemas import RunRequest, RunResult

router = APIRouter(tags=["agents"])


@router.post("/runs")
async def create_run(payload: RunRequest) -> RunResult:
    if not settings.anthropic_api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY ist nicht gesetzt — agent-engine kann noch nicht laufen.")

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    team = await design_team(client, settings.anthropic_model, payload.task)

    async with mcp_session(settings.actions_engine_mcp_url) as session:
        tools = await list_tools_as_anthropic_schema(session)
        graph = build_graph(team, client, settings.anthropic_model, session, tools)
        final_state = await graph.ainvoke({"task": payload.task, "steps": [], "last_output": None})

    return RunResult(
        task=payload.task,
        team=team,
        steps=final_state["steps"],
        final_answer=final_state["last_output"] or "",
    )
