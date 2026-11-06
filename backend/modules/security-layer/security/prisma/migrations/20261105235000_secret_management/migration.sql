ALTER TABLE "AuditLog"
    ADD COLUMN "actorType" TEXT,
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "environmentId" TEXT;

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workspace_tenantId_name_key" ON "Workspace"("tenantId", "name");
CREATE INDEX "Workspace_tenantId_idx" ON "Workspace"("tenantId");

CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_status_idx" ON "WorkspaceMembership"("userId", "status");
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Environment_tenantId_key_key" ON "Environment"("tenantId", "key");
CREATE INDEX "Environment_tenantId_idx" ON "Environment"("tenantId");

CREATE TABLE "SecretStore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elyvion-envelope-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecretStore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecretStore_tenantId_environmentId_key" ON "SecretStore"("tenantId", "environmentId");
CREATE INDEX "SecretStore_tenantId_idx" ON "SecretStore"("tenantId");

CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "adapterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "canonicalPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Secret_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Secret_canonicalPath_key" ON "Secret"("canonicalPath");
CREATE INDEX "Secret_tenantId_environmentId_workspaceId_adapterId_idx"
    ON "Secret"("tenantId", "environmentId", "workspaceId", "adapterId");
CREATE INDEX "Secret_tenantId_status_idx" ON "Secret"("tenantId", "status");

CREATE TABLE "SecretVersion" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "wrappedDek" TEXT NOT NULL,
    "keyIv" TEXT NOT NULL,
    "keyAuthTag" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "keyVersion" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecretVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SecretVersion_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SecretVersion_secretId_version_key" ON "SecretVersion"("secretId", "version");
CREATE INDEX "SecretVersion_keyVersion_idx" ON "SecretVersion"("keyVersion");

CREATE TABLE "SecretReference" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "adapterId" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "versionPolicy" TEXT NOT NULL DEFAULT 'latest',
    "pinnedVersion" INTEGER,
    "requiredMinimum" INTEGER,
    "canonicalPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecretReference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SecretReference_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SecretReference_canonicalPath_key" ON "SecretReference"("canonicalPath");
CREATE UNIQUE INDEX "SecretReference_environmentId_adapterId_configKey_key"
    ON "SecretReference"("environmentId", "adapterId", "configKey");
CREATE INDEX "SecretReference_tenantId_workspaceId_adapterId_idx"
    ON "SecretReference"("tenantId", "workspaceId", "adapterId");

CREATE TABLE "SecretAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "environmentId" TEXT,
    "workspaceId" TEXT,
    "adapterId" TEXT,
    "secretId" TEXT,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecretAccessLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecretAccessLog_tenantId_createdAt_idx" ON "SecretAccessLog"("tenantId", "createdAt");
CREATE INDEX "SecretAccessLog_secretId_createdAt_idx" ON "SecretAccessLog"("secretId", "createdAt");
CREATE INDEX "SecretAccessLog_actorId_createdAt_idx" ON "SecretAccessLog"("actorId", "createdAt");

INSERT INTO "Resource" ("id", "key", "name", "createdAt")
VALUES
    ('resource_security', 'security', 'Security', CURRENT_TIMESTAMP),
    ('resource_data_adapters', 'data-adapters', 'Data Adapters', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
SELECT
    'permission_' || seed."resourceKey" || '_' || seed."key",
    resource."id",
    seed."key",
    seed."name",
    CURRENT_TIMESTAMP
FROM (VALUES
    ('security', 'security.secret.create', 'Create secret'),
    ('security', 'security.secret.read', 'Read secret metadata'),
    ('security', 'security.secret.update', 'Update secret metadata'),
    ('security', 'security.secret.rotate', 'Rotate secret value'),
    ('security', 'security.secret.delete', 'Delete secret'),
    ('security', 'security.secret.use', 'Use secret at runtime'),
    ('security', 'security.secret.audit.read', 'Read secret access audit'),
    ('data-adapters', 'data.adapter.create', 'Create data adapter'),
    ('data-adapters', 'data.adapter.read', 'Read data adapters'),
    ('data-adapters', 'data.adapter.update', 'Update data adapters'),
    ('data-adapters', 'data.adapter.delete', 'Delete data adapters'),
    ('data-adapters', 'data.adapter.test', 'Test data adapters'),
    ('data-adapters', 'data.adapter.deploy', 'Deploy data adapters'),
    ('data-adapters', 'data.adapter.secret.configure', 'Configure adapter secret references')
) AS seed("resourceKey", "key", "name")
JOIN "Resource" resource ON resource."key" = seed."resourceKey"
ON CONFLICT ("resourceId", "key") DO NOTHING;

INSERT INTO "Role" ("id", "key", "name", "description", "createdAt")
VALUES
    ('role_adapter_workload', 'adapter-workload', 'Adapter Workload', 'Runtime-only permission to resolve assigned adapter secrets.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission ON permission."key" = 'security.secret.use'
JOIN "Resource" resource ON resource."id" = permission."resourceId" AND resource."key" = 'security'
WHERE role."key" = 'adapter-workload'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'tenant-admin'
  AND resource."key" = 'security'
  AND permission."key" <> 'security.secret.use'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'tenant-admin'
  AND resource."key" = 'data-adapters'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT 'grant_' || role."key" || '_' || permission."id", role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
JOIN "Resource" resource ON resource."id" = permission."resourceId"
WHERE role."key" = 'developer'
  AND (
    (resource."key" = 'security' AND permission."key" IN (
      'security.secret.create', 'security.secret.read', 'security.secret.delete', 'security.secret.update', 'security.secret.rotate'
    ))
    OR (resource."key" = 'data-adapters' AND permission."key" IN (
      'data.adapter.create', 'data.adapter.read', 'data.adapter.update',
      'data.adapter.test', 'data.adapter.deploy', 'data.adapter.secret.configure'
    ))
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
