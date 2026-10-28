# deployment-engine

A configurable CI/CD-style deployment pipeline: builds and runs the application on a configurable **target**, and exposes "deploy" / "check status" / "stop" as actions so workflows and agents can trigger deployments. See the project's CI/CD concept discussion for the full phased plan (local Docker now → Infrastructure-as-Code + GitOps for a whole tenant's platform later).

## Architecture

- **`DeploymentTarget`** (Mongo) — a named target: `type` + a type-specific `config` (region, credentials, cluster, …).
- **`DeploymentExecutor`** (`executors/executor.interface.ts`) — one shape every target type implements: `validateConfig()`, `deploy()`, `stop()`, `getStatus()`. Adding a cloud provider means adding one class and one line in `executor-registry.ts`; nothing else in the module changes.
  - `local-docker` — **implemented**. Packages the already-built client bundle (`frontend/dist/client/browser`, override via `CLIENT_DIST_PATH`) into an `nginx:alpine` image and runs it as a container on the local Docker daemon via the `docker` CLI, on an auto-picked free port.
  - `aws` / `gcp` / `azure` — declared, selectable in the UI, but **not implemented**: each needs that provider's SDK and real credentials this environment doesn't have. Selecting one throws a clear `501 Not Implemented`.
- **`Deployment`** (Mongo) — one deploy attempt: status, the executor's opaque `handle` (e.g. a container id), port/URL, error.
- On a successful deploy, the resulting URL is registered with **telemetry** (`source: deployment`) so its health is tracked the same way a backend module's is — independent of whatever the deployed application itself reports (`getLiveStatus()` asks the executor directly, e.g. a live `docker inspect`, rather than trusting a stored status).

## Known limitation

Today's App-Builder has one global application, not yet multiple named apps — so `local-docker` deploys *the* client build, not a specific `applicationId`. Once multiple named apps exist, `LocalDockerExecutor.deploy()` is the one place that needs to build a per-app bundle instead.

If this module itself runs inside a container, the `local-docker` executor needs the host's Docker socket mounted in (`-v /var/run/docker.sock:/var/run/docker.sock`) to drive the host daemon — not needed when running the module directly on the host, as in local development.

## Actions (via actions-engine)

`list_deployment_targets`, `create_deployment_target`, `deploy_application`, `list_deployments`, `get_deployment_status`, `stop_deployment`.

## Endpoints

`POST /deployment-targets`, `GET /deployment-targets`, `POST /deployments`, `GET /deployments`, `GET /deployments/:id`, `GET /deployments/:id/status`, `POST /deployments/:id/stop`.
