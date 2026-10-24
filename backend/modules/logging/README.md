# logging

One place every module (backend or frontend) writes to when something
happens — "eigentlich sollte wirklich alles geloggt werden". Postgres
(Prisma, same shared instance `workflow-engine` uses, its own `logging`
schema), not Mongo — log entries are append-only, high-volume, and
queried by time range/source, exactly what a relational store with
indexes on `createdAt`/`source`/`actionKey` is good at.

## Why the Actions system is the main emitter

Rather than asking every action's own implementation to remember to log
itself, the two places an action actually *runs* — actions-engine's
`ActionsController.execute()` (backend, including remote-proxied
actions) and the frontend's `FrontendActionsService.execute()` — each
write one log entry per call, success or failure. Since "nearly
everything that changes state" is modeled as an action, this one
integration point gives "every action" coverage without touching
individual actions.

## Endpoints

- `POST /logs` — `{ source, level?, message, actionKey?, context? }`.
  `level` is one of `debug | info | warn | error`, default `info`.
- `GET /logs` — `?source=&level=&actionKey=&limit=` (default 100, max
  500), newest first.

## Client helpers

`@elyvion/shared`'s `logEvent()` and `elyvion_shared`'s `log_event()`
(TypeScript and Python respectively) are thin, fire-and-forget wrappers
— a logging call failing must never break whatever it's logging, so
neither retries nor throws; it just swallows the error.

## Local dev

```bash
cp .env.example .env
pnpm install
pnpm run prisma:migrate
pnpm run start:dev
```

Needs the shared Postgres instance running (see
`../../docker-compose.yml`) and the Registry module up so this can
self-register.
