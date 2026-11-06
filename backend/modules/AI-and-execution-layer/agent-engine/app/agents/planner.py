"""The "automatic team" part of this module: given a task description,
asks the LLM itself to design a small team of specialised agent roles for
it — a sequential pipeline of 2-4 agents, each with its own system prompt,
rather than a fixed one-size-fits-all role. No agent framework does this
dynamically at runtime (see `README.md`'s research note); this is Elyvion's
own layer on top of local-llm function calling, forcing a structured response
instead of parsing free text.
"""

import json

from . import prompts
from .llm_client import chat_completion
from .schemas import TeamSpec

_DESIGN_TEAM_TOOL = {
    "type": "function",
    "function": {
        "name": "design_team",
        "description": "Legt das Team aus Agenten fest, das die Aufgabe bearbeiten soll.",
        "parameters": {
            "type": "object",
            "properties": {
                "reasoning": {"type": "string"},
                "agents": {
                    "type": "array",
                    "minItems": 2,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Kurzer Name oder Rolle."},
                            "system_prompt": {"type": "string", "description": "Vollständige Instruktion."},
                            "focus": {"type": "string", "description": "Konkreter Arbeitsschwerpunkt."},
                        },
                        "required": ["name", "system_prompt", "focus"],
                    },
                },
            },
            "required": ["reasoning", "agents"],
        },
    },
}


async def design_team(llm_url: str, task: str) -> TeamSpec:
    response = await chat_completion(
        llm_url,
        [
            {"role": "system", "content": prompts.get("planner_system_prompt").value},
            {"role": "user", "content": task},
        ],
        tools=[_DESIGN_TEAM_TOOL],
        tool_choice={"type": "function", "function": {"name": "design_team"}},
    )
    tool_calls = response.get("tool_calls", [])
    for tool_call in tool_calls:
        function = tool_call.get("function", {})
        if function.get("name") == "design_team":
            arguments = function.get("arguments", {})
            if isinstance(arguments, str):
                arguments = json.loads(arguments)
            return TeamSpec.model_validate(arguments)
    raise RuntimeError("Der lokale LLM-Planer hat kein Team entworfen.")
