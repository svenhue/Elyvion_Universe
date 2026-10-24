# chat

Conversations with an LLM — Phase 3 of the pro-code assistant work (see
`actions-engine` for Phase 1 and the frontend's `AssistantWidgetComponent`
for Phase 2). A conversation has a `mode`: `"chat"` talks to the LLM
directly; `"agent"` is accepted and stored but 400s on `POST .../messages`
until `agent-engine` (next phase) exists to actually run a multi-agent
system against it — the mode field is there now so conversations created
today don't need a schema migration once agent-engine lands.

## LLM

Anthropic only, via `LlmService` — no provider abstraction, since there's
only one provider to abstract over yet. Without `ANTHROPIC_API_KEY` set,
`POST .../messages` 503s with a clear message instead of a raw SDK
exception.

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
