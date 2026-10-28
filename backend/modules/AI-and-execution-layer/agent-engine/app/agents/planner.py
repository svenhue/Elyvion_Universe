"""The "automatic team" part of this module: given a task description,
asks the LLM itself to design a small team of specialised agent roles for
it — a sequential pipeline of 2-4 agents, each with its own system prompt,
rather than a fixed one-size-fits-all role. No agent framework does this
dynamically at runtime (see `README.md`'s research note); this is Elyvion's
own layer on top of Anthropic's tool-use, forcing a structured response
instead of parsing free text.
"""

from anthropic import AsyncAnthropic

from . import prompts
from .schemas import TeamSpec

_DESIGN_TEAM_TOOL = {
    "name": "design_team",
    "description": "Legt das Team aus Agenten fest, das die Aufgabe bearbeiten soll.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reasoning": {
                "type": "string",
                "description": "Kurze Begründung, warum dieses Team zu dieser Aufgabe passt.",
            },
            "agents": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Kurzer Name/Rolle, z. B. 'Recherche-Agent'."},
                        "system_prompt": {
                            "type": "string",
                            "description": "Vollständige Instruktion für diesen Agenten.",
                        },
                        "focus": {"type": "string", "description": "Ein Satz, was dieser Agent konkret tut."},
                    },
                    "required": ["name", "system_prompt", "focus"],
                },
            },
        },
        "required": ["reasoning", "agents"],
    },
}


async def design_team(client: AsyncAnthropic, model: str, task: str) -> TeamSpec:
    response = await client.messages.create(
        model=model,
        max_tokens=1024,
        system=prompts.get("planner_system_prompt").value,
        tools=[_DESIGN_TEAM_TOOL],
        tool_choice={"type": "tool", "name": "design_team"},
        messages=[{"role": "user", "content": task}],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "design_team":
            return TeamSpec.model_validate(block.input)
    raise RuntimeError("Der Planer hat kein Team entworfen.")
