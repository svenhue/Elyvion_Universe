# actions-engine

A generic "run this action" primitive — Phase 1 of the pro-code assistant
work (see the Chat/Agent-Engine/floating-panel modules that build on this).
Modeled after what the market research behind this found missing in
Retool/n8n/Appsmith: none of them has an action with a declared input/output
contract that's reusable both as a workflow step **and** standalone/via MCP
— they only reuse whole (sub-)workflows. This module is that missing piece.

## Core idea

An **action** = `{ key, name, description, inputSchema, target }`.
`target` is `"backend"` (has a real handler here, callable via REST or MCP)
or `"frontend"` (metadata only — the Angular app owns the actual handler;
see `ActionsApiService`/`FrontendActionsService` on the frontend side).

- New backend actions: add a class implementing `ActionHandler`, decorate it
  with `@RegisterAction({...})` (see `builtin/`), add it to `ActionsModule`'s
  `providers` — `ActionsRegistry` discovers it on boot via `DiscoveryService`
  (the same mechanism `@nestjs/schedule`'s cron decorators use), nothing
  else needs to know about the new action.
- Frontend actions self-register their manifest (`POST /frontend-actions`)
  at app boot, the same way backend modules self-register with the Registry.

## Endpoints

- `GET /actions` — every action (backend + frontend), with `inputSchema` as
  JSON Schema.
- `GET /actions/:key` — one action.
- `POST /execute/:key` — runs a **backend** action (validates input against
  its zod schema first); 400s with a clear message for a frontend-target
  key, since this process has no way to reach into a browser.
- `POST /frontend-actions` — upsert a frontend action's manifest.
- `ALL /mcp` — an MCP server (Streamable HTTP, stateless) exposing every
  backend action as an MCP tool, so an AI agent gets the same catalog a
  human sees in the Actions panel.

## Local dev

```bash
cp .env.example .env
pnpm install
pnpm run start:dev
```

Needs MongoDB running (see `../../docker-compose.yml`) and the Registry
module up so this can self-register.
