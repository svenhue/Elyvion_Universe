"""Builds and runs the actual multi-agent graph for one `TeamSpec` — a
straight sequential pipeline (agent 1's output feeds agent 2, and so on),
compiled as a real LangGraph `StateGraph` rather than a hand-rolled loop,
so the execution model is the same graph abstraction this project already
uses for workflows and ontologies. Each node is a short ReAct loop of its
own: call the LLM with the MCP-discovered tools, execute any tool call it
asks for, feed the result back, repeat until it answers in plain text.

Only a sequential topology is implemented here — no parallel fan-out or
supervisor-style routing yet (see `README.md`). A faithful next step, not
something any agent framework ships ready-made (per this phase's research
note): those only let the developer *choose among* pre-authored roles,
never design new ones per task the way `planner.design_team` does.
"""

import json
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph
from mcp import ClientSession

from .mcp_client import call_tool
from .llm_client import chat_completion
from .schemas import AgentRole, AgentStepResult, TeamSpec

_MAX_TOOL_ITERATIONS = 5


class GraphState(TypedDict):
    task: str
    steps: list[AgentStepResult]
    last_output: str | None


async def _run_agent_step(
    llm_url: str,
    session: ClientSession,
    tools: list[dict],
    role: AgentRole,
    task: str,
    previous_output: str | None,
) -> AgentStepResult:
    user_content = (
        task
        if previous_output is None
        else f"Aufgabe: {task}\n\nBisheriges Ergebnis des vorherigen Agenten:\n{previous_output}"
    )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": role.system_prompt},
        {"role": "user", "content": user_content},
    ]
    tool_calls: list[str] = []

    for _ in range(_MAX_TOOL_ITERATIONS):
        response = await chat_completion(llm_url, messages, tools=tools)
        calls = response.get("tool_calls") or []
        if not calls:
            return AgentStepResult(
                agent_name=role.name,
                output=response.get("content") or "",
                tool_calls=tool_calls,
            )

        messages.append({
            "role": "assistant",
            "content": response.get("content") or "",
            "tool_calls": calls,
        })
        for call in calls:
            function = call.get("function", {})
            name = function.get("name")
            arguments = function.get("arguments", {})
            if isinstance(arguments, str):
                arguments = json.loads(arguments)
            if not isinstance(name, str) or not isinstance(arguments, dict):
                raise RuntimeError("Local LLM returned an invalid action call.")
            tool_calls.append(name)
            output = await call_tool(session, name, arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": output,
            })

    return AgentStepResult(
        agent_name=role.name,
        output="(Maximale Anzahl an Werkzeug-Aufrufen erreicht, ohne eine endgültige Antwort.)",
        tool_calls=tool_calls,
    )


def _make_node(
    role: AgentRole,
    llm_url: str,
    session: ClientSession,
    tools: list[dict],
):
    async def node(state: GraphState) -> dict:
        result = await _run_agent_step(llm_url, session, tools, role, state["task"], state["last_output"])
        return {"steps": [*state["steps"], result], "last_output": result.output}

    return node


def build_graph(
    team: TeamSpec,
    llm_url: str,
    session: ClientSession,
    tools: list[dict],
):
    graph = StateGraph(GraphState)
    previous_name: str | None = None
    for role in team.agents:
        graph.add_node(role.name, _make_node(role, llm_url, session, tools))
        if previous_name is None:
            graph.set_entry_point(role.name)
        else:
            graph.add_edge(previous_name, role.name)
        previous_name = role.name
    graph.add_edge(previous_name, END)
    return graph.compile()
