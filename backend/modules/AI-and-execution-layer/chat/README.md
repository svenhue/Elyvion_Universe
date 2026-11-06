# chat

Conversations with an LLM — Phase 3 of the pro-code assistant work (see
`actions-engine` for Phase 1 and the frontend's `AssistantWidgetComponent`
for Phase 2). A conversation has a `mode`: `"chat"` replies via the LLM
directly (`LlmService`); `"agent"` runs a multi-agent system against
`agent-engine` instead (`AgentEngineClient` — a direct Registry-looked-up
call, not through the gateway, since a multi-agent run can take well
past the gateway proxy's timeout).

## LLM

Chat uses the central `local-llm` module, which forwards compatible
chat-completion requests to the globally configured Ollama instance. Agent
mode also routes every planning and tool-use completion through `local-llm`.
Configure only `LOCAL_LLM_URL` in this service; platform administrators
manage the model, Ollama URL, temperature, and context size in the Admin UI.

## Endpoints

- `POST /conversations` — `{ title?, mode? }`
- `GET /conversations`
- `GET /conversations/:id/messages`
- `POST /conversations/:id/messages` — `{ content }`, replies with the
  assistant's message (the user's message is saved first either way)

## Local dev

```bash
cp .env.example .env
pnpm install
pnpm run start:dev
```

Needs MongoDB and Ollama running (see `../../docker-compose.yml`), the
`local-llm` module, and the Registry module up so this can self-register.
