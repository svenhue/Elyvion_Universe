from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


class AgentRole(BaseModel):
    name: str
    system_prompt: str
    """What this agent is told to do — its whole personality/instructions for this run."""
    focus: str
    """One short line describing this agent's job, shown to the user — not sent to the LLM."""


class TeamSpec(BaseModel):
    reasoning: str
    """Why the planner chose this team for this task — shown to the user for transparency."""
    agents: list[AgentRole]


class RunRequest(BaseModel):
    task: str


class AgentStepResult(BaseModel):
    agent_name: str
    output: str
    tool_calls: list[str] = Field(default_factory=list)
    """Names of actions-engine actions this agent invoked while producing `output`."""


class RunStatus(str, Enum):
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class RunResult(BaseModel):
    """One `POST /runs` call's state — created with `status="running"` and
    updated in place as the graph executes (see `router._execute_run`), so
    `GET /runs`/`GET /runs/{id}` always reflects live progress, not just
    the final outcome. Kept in-process only (see `store.py`) — acceptable
    for now since nothing else needs a run's history to survive a restart.
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    task: str
    status: RunStatus = RunStatus.running
    team: TeamSpec | None = None
    steps: list[AgentStepResult] = Field(default_factory=list)
    final_answer: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
