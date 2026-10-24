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


class RunResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    task: str
    team: TeamSpec
    steps: list[AgentStepResult]
    final_answer: str
