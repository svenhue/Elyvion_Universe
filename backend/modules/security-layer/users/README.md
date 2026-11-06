# Users service

Users owns user accounts, tenants, and tenant memberships. Authentication
remains in the Auth service; authorization decisions and tenant-scoped roles
remain in the Security service.

## Tenant and membership operations

- `GET /tenant-membership` — requires a bearer token and `x-tenant-id`;
  validates the token subject's active membership. Used internally by
  Security during each PDP decision.
- `POST /operator/tenants/bootstrap` — creates a tenant and its initial
  membership. Requires `x-operator-token` matching `TENANT_BOOTSTRAP_TOKEN`.
- `POST /operator/tenants/:tenantId/members` — adds a user with an existing
  account to that tenant. Requires the same operator token. Role assignment
  is a separate Security operation.

Registration creates an account but does not grant an authorization role.
There is no implicit shared legacy tenant or platform-admin membership.
Users and legacy roles must be explicitly mapped during migration.

## Service credentials

- `USERS_SERVICE_TOKEN` is required for internal Auth-to-Users credential
  verification and must match in both services.
- `TENANT_BOOTSTRAP_TOKEN` is for operator-only tenant and membership
  operations; do not expose it to browsers.
- Membership validation requires the shared `AUTH_ISSUER_URL` and
  `API_AUDIENCE` token-verification configuration.

Apply the Prisma migration before starting the service with tenant-aware
authorization enabled.
