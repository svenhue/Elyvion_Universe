# Security authorization service

The Security service is the source of truth for tenant-scoped permissions.
It evaluates authorization decisions and records them in its audit table.
The Users service owns tenants and active memberships; Security validates
membership there for each decision.

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

- Tenants and active/inactive memberships are owned by the Users service.
- Role assignments and object permissions are scoped to a tenant.
- `tenant-admin` and `developer` are seeded roles; no platform-admin role is
  implicitly granted.
- Data permissions may include row filters, column masking, and row limits.
- Old unscoped assignments remain in the database but are not effective.
- Audit stores minimized decision data. An audit-write failure prevents an
  allow decision.

## Bootstrap and migration

1. Apply the Users and Security Prisma migrations.
2. Set `TENANT_BOOTSTRAP_TOKEN` in Users and `SECURITY_OPERATOR_TOKEN` in
   Security; keep both operator-only.
3. Use `POST /operator/tenants/bootstrap` in Users with
   `x-operator-token` to create a tenant and its initial membership.
4. Assign `tenant-admin` using Security's
   `POST /operator/tenant-assignments` with `x-operator-token`.
5. Add further memberships through Users, then assign each user's
   tenant-scoped role through Security.
6. To import legacy role/permission data, provide an explicit mapping file
   and run `pnpm --filter security authz:migrate-legacy` with
   `USERS_DATABASE_URL`, `DATABASE_URL`, and `LEGACY_AUTH_MAPPING_FILE`.
   Legacy users must already have active membership in the explicitly
   mapped tenant. Unscoped MongoDB records require a separate explicit
   migration; they are not assigned automatically.

The mapping file format and script options are documented in
`prisma/migrate-legacy-authorization.ts`. Test migrations and mappings
against disposable databases before production use.

## Operator-protected endpoints

Resource/permission registration and role, grant, assignment, and
object-permission administration require `x-operator-token` matching
`SECURITY_OPERATOR_TOKEN`. Runtime PEP calls use `/v1/authorize` and do not
use the operator token.

ABAC policies, richer relationship models, audit retention/reporting,
tenant-administration UI, and a frontend tenant-selection state are not part
of this initial RBAC slice. Frontend actions that require permission must be
called with a selected `tenantId`; otherwise they deny. Durable workflow-run
identity delegation is also still open; do not persist raw bearer tokens in
workflow context.

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
