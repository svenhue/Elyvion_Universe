# security

Central authorization decision point ("Security First"): every action execution, anywhere in the platform, should ask this module "darf der Agent/Benutzer das?" before it runs — see how `actions-engine` and the frontend's `FrontendActionsService` call `POST /authorize`.

## Model

- **`Resource`** — one per backend module, self-registered (mirrors how modules self-register their actions with actions-engine).
- **`Permission`** — one grantable capability within a Resource (e.g. `data-adapters:create_data_adapter`), self-registered alongside the resource. Each action that needs gating declares which permission it requires.
- **`Role`** — a named set of permissions, grantable to subjects. Roles can **inherit** from other roles (`RoleInheritance`): a role's effective permissions are its own direct grants plus every ancestor role's grants, resolved at authorization time (`RoleResolverService`, BFS with a cycle check on every new inheritance edge).
- **`RoleAssignment`** — subject (a `user` or an `agent` — agents are first-class actors here, not just users) → role.
- **`ObjectPermission`** — an instance-level override on top of the role-based decision. Each rule is local to its own object, so the two cases the platform needs stay independent: "this agent's role grants read access broadly, but this one record is off-limits" (a `deny` rule on just that object; every other object stays reachable through the role) and "this agent's role doesn't cover this permission at all, but it should see exactly these objects" (`allow` rules on just those objects).

## Authorization resolution order (`AuthorizationService.authorize`)

1. No `subjectId`/`subjectType` in the request → **allow**, with a reason flagging that no identity was threaded through. actions-engine doesn't yet propagate a real caller identity into action execution — this keeps the system usable until that's wired in, without pretending to enforce something it can't yet see.
2. Unknown resource/permission key → **deny** (fail closed on a typo or a module that hasn't registered yet).
3. An object-level `deny` for this exact subject+permission+object → **deny**, regardless of role (blacklist).
4. Otherwise, the subject's effective roles (direct + inherited) → **allow** if any of them grants the permission.
5. Otherwise, an object-level `allow` for this exact object → **allow** (whitelist, for a permission the role doesn't grant at all).
6. Otherwise → **deny**.

## Endpoints

- Self-registration: `POST /resources`, `POST /permissions`.
- Admin: `GET /resources`, `POST /roles`, `GET /roles`, `POST /roles/:roleId/permissions`, `DELETE /roles/:roleId/permissions/:permissionId`, `POST /roles/:roleId/parents`, `DELETE /roles/:roleId/parents/:parentRoleId`, `POST /role-assignments`, `GET /role-assignments?subjectId=`, `DELETE /role-assignments/:id`, `POST /object-permissions`, `GET /object-permissions?subjectId=`, `DELETE /object-permissions/:id`.
- The decision: `POST /authorize` `{ subjectId?, subjectType?, resourceKey, permissionKey, objectId? }` → `{ allowed, reason }`.

## What's deliberately not done yet

No real caller identity flows from a user's session or an agent's run into action execution — `actions-engine`'s `execute()` call has nowhere to get a `subjectId` from today. Until that's wired in, authorization runs in "default allow, log it" mode whenever no subject is given (point 1 above). Only `data-adapters` and `deployment-engine` currently have resources/permissions registered and a few of their actions gated, as a working example of the full pattern; retrofitting every other module's actions is mechanical once identity propagation exists.
