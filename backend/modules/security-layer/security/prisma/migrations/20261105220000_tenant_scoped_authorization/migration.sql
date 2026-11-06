ALTER TABLE "RolePermission" ADD COLUMN "obligations" JSONB;

ALTER TABLE "RoleAssignment"
    ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'unscoped';
DROP INDEX "RoleAssignment_subjectId_roleId_key";
DROP INDEX "RoleAssignment_subjectId_idx";
CREATE UNIQUE INDEX "RoleAssignment_subjectId_subjectType_tenantId_roleId_key"
    ON "RoleAssignment"("subjectId", "subjectType", "tenantId", "roleId");
CREATE INDEX "RoleAssignment_subjectId_subjectType_tenantId_idx"
    ON "RoleAssignment"("subjectId", "subjectType", "tenantId");

ALTER TABLE "ObjectPermission"
    ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'unscoped';
DROP INDEX "ObjectPermission_subjectId_permissionId_objectId_key";
DROP INDEX "ObjectPermission_subjectId_permissionId_idx";
CREATE UNIQUE INDEX "ObjectPermission_subjectId_subjectType_tenantId_permissionId_objectId_key"
    ON "ObjectPermission"("subjectId", "subjectType", "tenantId", "permissionId", "objectId");
CREATE INDEX "ObjectPermission_subjectId_subjectType_tenantId_permissionId_idx"
    ON "ObjectPermission"("subjectId", "subjectType", "tenantId", "permissionId");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "userId" TEXT,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedPolicies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evaluatedPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "obligations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_decision_createdAt_idx" ON "AuditLog"("decision", "createdAt");

INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES
    ('resource_data_engine', 'data-engine', 'Data Engine', CURRENT_TIMESTAMP),
    ('resource_deployment_engine', 'deployment-engine', 'Deployment Engine', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_' || seed."resourceKey" || '_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('data-engine', 'data.entity.create', 'Create entity'),
    ('data-engine', 'data.entity.read', 'Read entities'),
    ('data-engine', 'data.entity.delete', 'Delete entity'),
    ('data-engine', 'data.record.create', 'Create records'),
    ('data-engine', 'data.record.read', 'Read records'),
    ('data-engine', 'data.record.update', 'Update records'),
    ('data-engine', 'data.record.delete', 'Delete records'),
    ('deployment-engine', 'development.deployment-target.create', 'Create deployment target'),
    ('deployment-engine', 'development.deployment-target.read', 'Read deployment targets'),
    ('deployment-engine', 'development.deployment.execute', 'Execute deployment'),
    ('deployment-engine', 'development.deployment.read', 'Read deployments'),
    ('deployment-engine', 'development.deployment.stop', 'Stop deployment')
) AS seed("resourceKey", "key", "name")
JOIN "Resource" resource ON resource."key" = seed."resourceKey"
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "Role" ("id", "key", "name", "description", "createdAt")
VALUES
    ('role_tenant_admin', 'tenant-admin', 'Tenant Admin', 'Administrator scoped to one tenant.', CURRENT_TIMESTAMP),
    ('role_developer', 'developer', 'Developer', 'Development permissions scoped to one tenant.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'tenant-admin'
   OR (role."key" = 'developer' AND (
       (resource."key" = 'data-engine' AND permission."key" IN (
           'data.entity.create', 'data.entity.read',
           'data.record.create', 'data.record.read', 'data.record.update', 'data.record.delete'
       ))
       OR (resource."key" = 'deployment-engine' AND permission."key" IN (
           'development.deployment-target.read',
           'development.deployment.execute', 'development.deployment.read', 'development.deployment.stop'
       ))
   ))
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
