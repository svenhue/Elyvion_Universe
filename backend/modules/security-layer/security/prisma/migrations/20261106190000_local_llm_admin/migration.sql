INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES ('resource_local_llm', 'local-llm', 'Local LLM', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_local_llm_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('ai.llm.read', 'Read global LLM configuration'),
    ('ai.llm.configure', 'Change global LLM configuration')
) AS seed("key", "name")
JOIN "Resource" resource ON resource."key" = 'local-llm'
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
    'grant_' || role."key" || '_' || permission."id",
    role."id",
    permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'tenant-admin'
  AND resource."key" = 'local-llm'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
