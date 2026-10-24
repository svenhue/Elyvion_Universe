# agent-engine

Runs an LLM-designed team of agents against a task — Phase 4 of the
pro-code assistant work (see `actions-engine` for Phase 1, the frontend's
`AssistantWidgetComponent` for Phase 2, and `chat` for Phase 3, whose
`"agent"`-mode conversations call this module directly, not through the
gateway, since a multi-step run can run well past the gateway's proxy
timeout — the same reason `workflow-engine` calls other modules directly
via a Registry lookup instead of through the gateway too).

Python/FastAPI, not NestJS — the richest multi-agent ecosystem
(LangGraph, the one used here, plus CrewAI/AutoGen) is Python's, and
`ontology-engine` already set the precedent of picking Python for a
module when the workload calls for it.

## How a run works

1. **`planner.design_team`** — asks the LLM itself to design a team of
   2-4 specialised agents for the given task (name, full system prompt,
   one-line focus), forced into a structured response via Anthropic's
   tool-use rather than parsed from free text. This is the "automatic
   architecture" part: **no multi-agent framework researched (LangGraph,
   CrewAI, AutoGen) actually does this at runtime** — they all require
   agent roles to be authored in advance, with any dynamism limited to
   *routing/delegation* among a pre-defined set. Designing the roles
   themselves per task is this module's own layer on top of LangGraph's
   primitives, not a standard feature it ships with.
2. **`runner.build_graph`** — compiles the planner's team into a real
   LangGraph `StateGraph`: one node per agent, chained sequentially
   (agent *n*'s output feeds agent *n+1*). Only this one topology is
   implemented — no parallel fan-out or supervisor-style routing yet.
   Each node is a short ReAct loop of its own (`_run_agent_step`): call
   the LLM with the available tools, run any tool call it requests, feed
   the result back, repeat (capped) until it answers in plain text.
3. **Tools** — every agent's tool access goes through `mcp_client.py`,
   which connects to `actions-engine`'s `/mcp` endpoint as an MCP
   *client*. An agent sees exactly the same action catalog a human sees
   in the assistant widget's Actions tab or an MCP-connected Claude
   session — no separate "agent tool" integration to keep in sync.

## Endpoint

- `POST /runs` — `{ task: string }` → `{ team, steps, final_answer }`.
  Synchronous: a run can take a while (several sequential LLM calls,
  each potentially with its own tool-use round trips), but that's an
  acceptable MVP trade-off for now — no job queue yet, unlike
  `workflow-engine`'s BullMQ-backed runs.

Without `ANTHROPIC_API_KEY` set, this 503s with a clear message instead
of failing deep inside the SDK.

## Local dev

```bash
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8101
```

Needs the Registry module up (to self-register) and `actions-engine`
running (its MCP endpoint is this module's only source of tools).
