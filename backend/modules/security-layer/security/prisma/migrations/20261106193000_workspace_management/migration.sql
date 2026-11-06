INSERT INTO "Role" ("id", "key", "name", "description", "createdAt")
VALUES ('role_platform_admin', 'admin', 'Platform Admin', 'Administrator of platform configuration and workspaces.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES ('resource_workspace_management', 'workspace-management', 'Workspace Management', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_workspace_management_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('workspace.read', 'Read workspaces'),
    ('workspace.create', 'Create workspaces'),
    ('workspace.update', 'Update workspaces'),
    ('workspace.delete', 'Delete workspaces')
) AS seed("key", "name")
JOIN "Resource" resource ON resource."key" = 'workspace-management'
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE resource."key" = 'workspace-management'
  AND (
      role."key" IN ('admin', 'tenant-admin')
      OR (role."key" = 'developer' AND permission."key" IN (
          'workspace.read', 'workspace.create', 'workspace.update'
      ))
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'admin'
  AND resource."key" = 'local-llm'
  AND permission."key" IN ('ai.llm.read', 'ai.llm.configure')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES ('resource_platform_configuration', 'platform-configuration', 'Platform Configuration', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_platform_configuration_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('platform.configuration.read', 'Read platform configuration')
) AS seed("key", "name")
JOIN "Resource" resource ON resource."key" = 'platform-configuration'
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" IN ('admin', 'tenant-admin')
  AND resource."key" = 'platform-configuration'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
