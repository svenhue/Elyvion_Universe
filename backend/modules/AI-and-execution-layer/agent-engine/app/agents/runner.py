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

from typing import Any, TypedDict

from anthropic import AsyncAnthropic
from langgraph.graph import END, StateGraph
from mcp import ClientSession

from .mcp_client import call_tool
from .schemas import AgentRole, AgentStepResult, TeamSpec

_MAX_TOOL_ITERATIONS = 5


class GraphState(TypedDict):
    task: str
    steps: list[AgentStepResult]
    last_output: str | None


async def _run_agent_step(
    client: AsyncAnthropic,
    model: str,
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
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_content}]
    tool_calls: list[str] = []

    for _ in range(_MAX_TOOL_ITERATIONS):
        response = await client.messages.create(
            model=model,
            max_tokens=1024,
            system=role.system_prompt,
            tools=tools,
            messages=messages,
        )
        if response.stop_reason != "tool_use":
            text = "".join(block.text for block in response.content if block.type == "text")
            return AgentStepResult(agent_name=role.name, output=text, tool_calls=tool_calls)

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append(block.name)
                output = await call_tool(session, block.name, block.input)
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})
        messages.append({"role": "user", "content": tool_results})

    return AgentStepResult(
        agent_name=role.name,
        output="(Maximale Anzahl an Werkzeug-Aufrufen erreicht, ohne eine endgültige Antwort.)",
        tool_calls=tool_calls,
    )


def _make_node(
    role: AgentRole,
    client: AsyncAnthropic,
    model: str,
    session: ClientSession,
    tools: list[dict],
):
    async def node(state: GraphState) -> dict:
        result = await _run_agent_step(client, model, session, tools, role, state["task"], state["last_output"])
        return {"steps": [*state["steps"], result], "last_output": result.output}

    return node


def build_graph(
    team: TeamSpec,
    client: AsyncAnthropic,
    model: str,
    session: ClientSession,
    tools: list[dict],
):
    graph = StateGraph(GraphState)
    previous_name: str | None = None
    for role in team.agents:
        graph.add_node(role.name, _make_node(role, client, model, session, tools))
        if previous_name is None:
            graph.set_entry_point(role.name)
        else:
            graph.add_edge(previous_name, role.name)
        previous_name = role.name
    graph.add_edge(previous_name, END)
    return graph.compile()
