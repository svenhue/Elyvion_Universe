# telemetry

Tracks the health of every target in the environment — backend modules **and** deployed applications — as history, not just a last-known status. The Registry already pings its registered modules every 30s, but only ever keeps the *current* status; this module exists to answer "was X actually up an hour ago" and to track targets the Registry doesn't know about (a deployed application isn't a backend module).

## Model

- `HealthTarget` — a name + URL to ping, tagged by `source`: `registry_module` (auto-discovered, see below), `deployment` (registered by `deployment-engine` when it starts a container), or `manual`.
- `HealthCheckResult` — one ping's outcome (`up`/`down`, response time, error), kept forever (no retention policy yet — a follow-up once volume matters).

## Cron jobs

- Every minute: pulls the Registry's `GET /modules` and upserts each as a `registry_module` target — the target list for backend modules needs no manual registration.
- Every 30s: pings every known target and records the result.

## Actions (via actions-engine)

`get_system_health` (current status of everything), `get_target_health_history`.

## Endpoints

`GET /health/status`, `GET /health/targets/:id/history?limit=`, `POST /health/targets` (manual/deployment registration), `DELETE /health/targets/:name`.
