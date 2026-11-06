INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES ('resource_observability_traffic', 'observability-traffic', 'Traffic Observability', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_observability_traffic_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('observability.traffic.read', 'Read HTTP traffic metadata')
) AS seed("key", "name")
JOIN "Resource" resource ON resource."key" = 'observability-traffic'
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
    'grant_' || role."key" || '_' || permission."id",
    role."id",
    permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'admin'
  AND resource."key" = 'observability-traffic'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
