# workflow-engine

Backend workflow execution module. Stores versioned workflow definitions
(a step graph: `set-variable`, `http-request`, `call-service`,
`condition`, `delay`, `parallel`), runs them step-by-step on a BullMQ
queue (Redis-backed, retries with exponential backoff), and records every
step attempt in Postgres (`WorkflowRun` / `WorkflowStepRun`) — the
transaction log a failed step's `onError` branch compensates from.

Frontend-target workflows are *not* executed here — see the frontend's
`WorkflowRunnerService` (XState). This module only runs `target: "backend"`
workflows, plus stores both kinds' definitions for the pro-code builder.

## Endpoints

- `POST /definitions` — store a new version of a workflow.
- `GET /definitions` / `GET /definitions/:key` — read definitions.
- `POST /definitions/:key/run` — start a run (`{ context }` seeds it).
- `GET /runs/:runId` — a run's status and its full step history.

## Local dev

```bash
cp .env.example .env
pnpm install
pnpm run prisma:migrate
pnpm run dev
```

Needs Postgres and Redis running — see `../../docker-compose.yml`.
