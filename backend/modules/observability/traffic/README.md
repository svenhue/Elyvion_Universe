# HTTP Traffic Observability

The `traffic` service stores HTTP request metadata observed by applications
using the shared Node.js logger instrumentation or the shared Python ASGI
middleware. This is application telemetry, **not** packet capture: non-HTTP
protocols, uninstrumented processes, and traffic that bypasses these
applications are not captured. Python outbound clients must use the shared
`create_http_client()` factory to be observed.

## Collected data and safeguards

Each event contains a timestamp, source/target service, direction, HTTP
protocol, method, normalized path, status, content-length metadata, duration,
correlation ID, and a short sanitized error summary. Request/response bodies,
headers, cookies, authorization values, query strings/values, client IP
addresses, and raw exception messages are not persisted. Numeric and UUID path
segments and token-like path segments are normalized. Correlation IDs are
hashed; error text is generated from status codes rather than raw exceptions.

Ingestion is protected by `TRAFFIC_INGEST_TOKEN_FILE`. Runtime services post
events to `TRAFFIC_INGEST_URL` (defaults to the local traffic service for
host-based development). Use a mounted secret file with restrictive
permissions; the credential is read at process start, so restart services after
rotation. Do not put the token in source control, compose files, or logs.
Production ingestion endpoints must use HTTPS; keep the service on a private
network and avoid exposing its ingestion route publicly.
The traffic module rejects events without the shared token. Its event endpoint
is excluded from collection to prevent recursive ingestion.

The read API is guarded by the Security authorization service and the
`observability.traffic.read` permission. It additionally requires the request
tenant to match `TRAFFIC_ADMIN_TENANT_ID`. The UI must hide the page unless the
same permission is granted; API authorization remains authoritative.

Events are retained for 30 days by default. `TRAFFIC_RETENTION_DAYS` can be set
between 1 and 365. Expired rows are removed at service startup and daily.

## Local setup

1. Provision a random ingestion token outside the repository and expose it to
   the traffic service and instrumented services via a secret file.
2. Set `DATABASE_URL`, `TRAFFIC_ADMIN_TENANT_ID`, and
   `TRAFFIC_INGEST_TOKEN_FILE` from a protected runtime configuration.
3. Configure each instrumented process with
   `TRAFFIC_INGEST_URL=http://localhost:3025/internal/events` for host-based
   development, or the private traffic-service DNS name inside a container
   network, and mount the same token file. NestJS modules using
   `ElyvionLoggerModule` install Node's HTTP diagnostics hooks automatically.
   FastAPI modules should install `TrafficObservabilityMiddleware` and use the
   shared `create_http_client()` factory for outbound HTTP.
4. Run `pnpm --dir backend/modules/observability/traffic prisma:generate`,
   then `pnpm --dir backend/modules/observability/traffic prisma:migrate`,
   then start the service.
5. Apply the Security migration under
   `backend/modules/security-layer/security/prisma/migrations` before opening
   the Admin list.

The schema is isolated in the PostgreSQL `traffic` schema. The service does not
expose any API that returns HTTP payloads or ingestion credentials.
