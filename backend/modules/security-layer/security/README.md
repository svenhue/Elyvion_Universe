# Security service

The Security service is the single source of truth for users, tenants,
tenant memberships, roles, permissions, secrets, and authorization. Accounts
and tenant data live in the `security` PostgreSQL schema; there is no
separate Users service or `users` schema.

## Local Docker services

From `backend/`, start PostgreSQL and the Security Layer services with:

```sh
docker compose up -d postgres security auth
```

The containers connect to PostgreSQL at `postgres:5432` on the Compose
network. Host-run development modules use `localhost:5433`; this avoids
colliding with a PostgreSQL server already bound to the host's port `5432`.
Adminer remains available at `http://localhost:8081` and should connect to
the server named `postgres`, database `elyvion`.

Auth and Security are built from the backend pnpm workspace. Auth uses the
Security service for credential verification and account lookup via
`SECURITY_INTERNAL_TOKEN`; those internal routes are not public API routes.
The OIDC issuer remains `http://localhost:3011` for browser clients.

Local-only Docker credentials are mounted from `backend/.secrets/`. That
directory is ignored by Git; do not commit or share its contents. The
Security container fails closed if its encryption key or workload registry
is missing. Never add a placeholder workload identity just to make startup
succeed.

## Decision endpoint

`POST /v1/authorize` expects a verified bearer token, `x-tenant-id`, and a
body shaped like:

```json
{
  "action": "data.entity.read",
  "resource": { "type": "data-engine", "id": "optional-resource-id" },
  "context": {}
}
```

The user identity is derived from the validated token, never from request
body or caller-supplied subject headers. A missing/invalid token, missing
or inactive tenant membership, unknown permission, absent grant, malformed
request, failed audit write, or unavailable PDP denies the operation.
The response contains `decision: "ALLOW" | "DENY"`, `reason`, and
`obligations`.

PEPs must pass the original bearer token and `x-tenant-id`; they must not
trust a subject ID supplied by the caller. Data and Deployment Engine
enforce tenant scoping in their MongoDB queries in addition to the PDP
decision.

## Authorization model

- Tenants, accounts, and active/inactive memberships are owned by Security.
- Role assignments and object permissions are scoped to a tenant.
- `admin`, `tenant-admin`, and `developer` are seeded roles. The
  platform-configuration and workspace-management UI permissions are
  evaluated through this PDP, not inferred from JWT claims.
- Data permissions may include row filters, column masking, and row limits.
- Old unscoped assignments remain in the database but are not effective.
- Audit stores minimized decision data. An audit-write failure prevents an
  allow decision.

## Bootstrap and migration

1. Apply the Security Prisma migrations. The consolidation migration copies
   existing users, tenants, memberships, and legacy role grants from the
   former `users` schema before dropping that schema.
2. Set `SECURITY_OPERATOR_TOKEN`; keep it operator-only.
3. Use `POST /operator/tenants/bootstrap` in Security with
   `x-security-operator-token` to create a tenant and its initial membership.
4. Assign `tenant-admin` using Security's
   `POST /operator/tenant-assignments` with `x-operator-token`.
5. Add further memberships through Security, then assign each user's
   tenant-scoped role through Security.

## Operator-protected endpoints

Resource/permission registration and role, grant, assignment, and
object-permission administration require `x-operator-token` matching
`SECURITY_OPERATOR_TOKEN`. Runtime PEP calls use `/v1/authorize` and do not
use the operator token.

ABAC policies, richer relationship models, audit retention/reporting, and
tenant-administration UI are not part of this initial RBAC slice. The
frontend obtains a user's active tenant memberships from Security
`GET /tenants/mine`, persists the selected tenant/workspace in browser state,
and queries the PDP for menu visibility. This is only UI state; every
workspace mutation is independently authorized by Security. Durable
workflow-run identity delegation is also still open; do not persist raw
bearer tokens in workflow context.

## Workspace management

Authenticated workspace operations are tenant-scoped and use the same
Authorization Service decision path:

- `GET /v1/workspaces` requires `workspace.read`.
- `POST /v1/workspaces` requires `workspace.create`; the creator is added as
  an active workspace member.
- `PATCH /v1/workspaces/:id` requires `workspace.update`.
- `DELETE /v1/workspaces/:id` requires `workspace.delete` and soft-deletes
  the workspace, revoking its active memberships. Secret resolution also
  rejects inactive workspaces.

The `tenant-admin` role receives all four permissions; `developer` receives
read, create, and update. The platform-configuration menu permission is
`platform.configuration.read`; generic admin pages are mounted under
`/platform-configuration` and protected by that PDP decision.

Apply the migrations in order before using these routes. The frontend calls
Security's `/tenants/mine` endpoint, which returns only the authenticated user's active tenant
memberships and is not an operator endpoint.

## Data Adapter secret management

The Security service is the central secret metadata and ciphertext store.
`SecretVersion` stores AES-256-GCM ciphertext and a separately encrypted
data-encryption key; the key-encryption key is loaded from a mounted Docker
secret, never from the database, application image, or source tree. The API
returns secret metadata and `vault://` references only. The internal
`POST /v1/internal/secrets/resolve` route returns a plaintext value only to a
strictly scoped workload identity, for the adapter process to use in memory.

### Request and runtime flow

```mermaid
sequenceDiagram
  actor User
  participant UI as Workspace UI
  participant Adapter as Data Adapter service
  participant Security as Security / Secret Store
  participant Runtime as Adapter runtime
  User->>UI: Enter non-sensitive config and credentials
  UI->>Adapter: Create adapter + one-time credential inputs
  Adapter->>Security: Bearer-authorized, tenant/workspace/environment-scoped secret create
  Security->>Security: Validate scope, encrypt, persist ciphertext + audit
  Security-->>Adapter: Metadata + vault:// reference only
  Adapter->>Adapter: Persist connection config + reference metadata
  UI-->>User: Return adapter metadata; clear credential fields
  Runtime->>Security: Resolve reference with scoped workload identity
  Security->>Security: Check tenant/environment/workspace/adapter + role permission
  Security-->>Runtime: Plaintext value over HTTPS, only for this process
```

Adapter deployment is handled by the target Data Adapter runtime through
`POST /adapters/:targetAdapterId/deploy`. First create a target-environment
adapter and configure its credentials there. The deploy operation copies only
the source's non-sensitive connector configuration, validates matching
configuration keys, and stores a `DataAdapterDeployment` manifest containing
the target adapter's references only. It never copies source-environment
references or plaintext. The endpoint must be sent to a Data Adapter runtime
bound to the target environment. The separate Development Deployment Engine
still deploys only the shared client application; it does not launch isolated
Data Adapter containers.

### Data model and reference format

- `Workspace` and `WorkspaceMembership` scope user access to workspaces.
- `Environment` is tenant-scoped and keyed as `development`, `staging`, or
  `production`.
- `SecretStore` is unique per tenant/environment.
- `Secret` records tenant, environment, workspace, adapter, owner, name,
  type, status, expiry, version, and metadata.
- `SecretVersion` stores ciphertext, nonce/tag, wrapped data key, algorithm,
  and key version. It never stores plaintext.
- `SecretReference` binds a canonical path to one adapter config key and a
  `latest`, `pinned`, or `required-minimum` version policy.
- `SecretAccessLog` and the authorization `AuditLog` record metadata changes,
  reference creation, successful use, and denied/failed resolution.

Canonical references have this form:

```text
vault://tenants/{tenantId}/environments/{environmentId}/data-adapters/{adapterId}/{config/path}
```

The complete scope is checked again during every resolution; knowing a path
is not sufficient authorization.

### Permissions

| Action | Developer | Tenant admin | Adapter workload |
|---|---:|---:|---:|
| `security.secret.create/read/update/rotate/delete` | Yes, in own workspace | Yes, tenant scope | No |
| `security.secret.use` | Reference/configuration only; never reads value | Reference/configuration only; never reads value | Yes, exact mounted scopes |
| `security.secret.audit.read` | No | Yes | No |
| `data.adapter.create/read/update/test/deploy/secret.configure` | Workspace-scoped as granted | Tenant-scoped | No |

Authorization continues to fail closed. Production scope must not be added
to Development or Staging workload credential files.

### Key setup, rotation, and revocation

Set `SECRET_STORE_KEYS_FILE`, `SECRET_STORE_ACTIVE_KEY_VERSION`, and
`SECRET_STORE_WORKLOAD_CREDENTIALS_FILE` only in the Security runtime. Mount
both files as read-only Docker secrets. The keyring JSON maps version names
to base64-encoded random 32-byte keys; the workload JSON maps workload IDs
to an opaque token and non-empty allowlists for tenant, exactly one
environment, workspace, and adapter IDs. Run a Data Adapter service instance
per environment with `DATA_ADAPTER_ENVIRONMENT_ID` set to its environment;
the instance rejects requests and secret resolution for other environments.
The Data Adapter gets its own read-only workload credential file via
`SECRET_STORE_WORKLOAD_CREDENTIAL_FILE`. Do not put either file's contents
in `.env`, Compose, logs, images, or CI variables.
Configure `SECURITY_URL` with HTTPS in non-local environments; TLS must be
terminated by the internal ingress/service mesh because this service does
not itself configure TLS.

Create each workspace and its memberships through the operator-only
`POST /operator/workspaces` and `/operator/workspaces/:workspaceId/members`
routes. Create each tenant's Development, Staging, and Production records
through `POST /operator/environments`. Assign the `adapter-workload` role to
the workload's `agent` subject with the operator-only
`POST /role-assignments` route, using the role ID returned from `GET /roles`.
The workload credential file allowlists must match the same tenant,
environment, workspace, and adapter scope; either side missing scope denies
resolution. Keep the environment-specific identity file separate for each
Data Adapter runtime.

For KEK rotation, add a new key version to the mounted keyring, change
`SECRET_STORE_ACTIVE_KEY_VERSION`, and retain old key versions until every
wrapped DEK has been rewrapped or its secret retired. For a credential
rotation, use `POST /v1/secrets/:id/rotate`; this adds a new encrypted
version and returns metadata only. Disable a secret to immediately block
future resolutions; delete it to remove stored versions/references and keep
a tombstone plus audit record.

### Legacy data and incident response

Data Adapter startup intentionally fails closed if it finds unscoped legacy
adapters or inline credential fields. There is no automatic conversion or
plaintext migration; inventory and remove or manually reconfigure legacy
records in a controlled maintenance window before deploying the new service.

If a leak is suspected: disable/revoke affected secrets; rotate affected
credentials at their upstream systems; review Security audit records and
workload credential scopes; replace compromised workload credentials and
KEKs as appropriate; inspect logs, traces, images, backups, and CI artifacts
for exposure; notify affected tenant owners; and preserve incident evidence.
Never paste secret values into incident tickets or logs.

### External Secret Manager migration

`SecretsService` is the storage boundary. A future Vault or cloud KMS adapter
should implement its encryption/storage operations behind this service,
preserve canonical references and authorization/audit semantics, and migrate
each version without exposing plaintext to the frontend. A staged migration
must verify tenant/environment isolation, key-version readability, rollback,
and audit continuity before changing the active provider. Do not run both
stores as independent sources of truth.
