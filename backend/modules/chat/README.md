# chat

Conversations with an LLM — Phase 3 of the pro-code assistant work (see
`actions-engine` for Phase 1 and the frontend's `AssistantWidgetComponent`
for Phase 2). A conversation has a `mode`: `"chat"` replies via the LLM
directly (`LlmService`); `"agent"` runs a multi-agent system against
`agent-engine` instead (`AgentEngineClient` — a direct Registry-looked-up
call, not through the gateway, since a multi-agent run can take well
past the gateway proxy's timeout).

## LLM

Anthropic only, via `LlmService` — no provider abstraction, since there's
only one provider to abstract over yet. Without `ANTHROPIC_API_KEY` set,
`POST .../messages` 503s with a clear message instead of a raw SDK
exception. The same is true of `agent-engine` itself for `"agent"` mode.

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

Needs MongoDB running (see `../../docker-compose.yml`) and the Registry
module up so this can self-register.
