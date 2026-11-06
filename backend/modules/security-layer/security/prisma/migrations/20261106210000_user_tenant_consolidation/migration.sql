CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended');
CREATE TYPE "TenantMembershipStatus" AS ENUM ('active', 'invited', 'suspended');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Tenant_status_name_idx" ON "Tenant"("status", "name");

CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TenantMembershipStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantMembership_tenantId_userId_key"
    ON "TenantMembership"("tenantId", "userId");
CREATE INDEX "TenantMembership_userId_status_idx"
    ON "TenantMembership"("userId", "status");
CREATE INDEX "TenantMembership_tenantId_status_idx"
    ON "TenantMembership"("tenantId", "status");
ALTER TABLE "TenantMembership"
    ADD CONSTRAINT "TenantMembership_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership"
    ADD CONSTRAINT "TenantMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $migration$
DECLARE
    has_legacy_users BOOLEAN := to_regclass('users."User"') IS NOT NULL;
BEGIN
    IF has_legacy_users THEN
        INSERT INTO "User" ("id", "email", "passwordHash", "name", "createdAt")
        SELECT "id", "email", "passwordHash", "name", "createdAt"
        FROM users."User"
        ON CONFLICT ("id") DO NOTHING;

        INSERT INTO "Tenant" ("id", "name", "status", "createdAt", "updatedAt")
        SELECT "id", "name", "status"::text::"TenantStatus", "createdAt", "updatedAt"
        FROM users."Tenant"
        ON CONFLICT ("id") DO NOTHING;

        INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "status", "createdAt", "updatedAt")
        SELECT "id", "tenantId", "userId", "status"::text::"TenantMembershipStatus", "createdAt", "updatedAt"
        FROM users."TenantMembership"
        ON CONFLICT ("id") DO NOTHING;

        INSERT INTO "Resource" ("id", "key", "name", "description", "createdAt")
        VALUES ('resource_legacy_users', 'legacy-users', 'Legacy users', 'Imported role permissions from the former users schema.', CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO NOTHING;

        INSERT INTO "Permission" ("id", "resourceId", "key", "name", "createdAt")
        SELECT
            'legacy_permission_' || md5(permission."name"),
            resource."id",
            coalesce(nullif(trim(both '-' from regexp_replace(lower(permission."name"), '[^a-z0-9]+', '-', 'g')), ''), 'permission-' || md5(permission."name")),
            permission."name",
            CURRENT_TIMESTAMP
        FROM users."Permission" permission
        CROSS JOIN "Resource" resource
        WHERE resource."key" = 'legacy-users'
        ON CONFLICT ("resourceId", "key") DO NOTHING;

        INSERT INTO "Role" ("id", "key", "name", "createdAt")
        SELECT
            'legacy_role_' || md5(role."id"),
            'legacy-' || coalesce(nullif(trim(both '-' from regexp_replace(lower(role."name"), '[^a-z0-9]+', '-', 'g')), ''), md5(role."id")),
            role."name",
            CURRENT_TIMESTAMP
        FROM users."Role" role
        ON CONFLICT ("key") DO NOTHING;

        INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
        SELECT
            'legacy_grant_' || md5(legacy_role."id" || ':' || legacy_permission."id"),
            target_role."id",
            target_permission."id"
        FROM users."RolePermission" legacy_grant
        JOIN users."Role" legacy_role ON legacy_role."id" = legacy_grant."roleId"
        JOIN users."Permission" legacy_permission ON legacy_permission."id" = legacy_grant."permissionId"
        JOIN "Role" target_role
          ON target_role."key" = 'legacy-' || coalesce(
              nullif(trim(both '-' from regexp_replace(lower(legacy_role."name"), '[^a-z0-9]+', '-', 'g')), ''),
              md5(legacy_role."id")
          )
        JOIN "Resource" resource ON resource."key" = 'legacy-users'
        JOIN "Permission" target_permission
          ON target_permission."resourceId" = resource."id"
         AND target_permission."key" = coalesce(
              nullif(trim(both '-' from regexp_replace(lower(legacy_permission."name"), '[^a-z0-9]+', '-', 'g')), ''),
              'permission-' || md5(legacy_permission."name")
         )
        ON CONFLICT ("roleId", "permissionId") DO NOTHING;

        INSERT INTO "RoleAssignment" ("id", "subjectId", "subjectType", "tenantId", "roleId", "createdAt")
        SELECT
            'legacy_assignment_' || md5(legacy_assignment."userId" || ':' || membership."tenantId" || ':' || target_role."id"),
            legacy_assignment."userId",
            'user'::"SubjectType",
            membership."tenantId",
            target_role."id",
            CURRENT_TIMESTAMP
        FROM users."UserRole" legacy_assignment
        JOIN users."Role" legacy_role ON legacy_role."id" = legacy_assignment."roleId"
        JOIN users."TenantMembership" membership
          ON membership."userId" = legacy_assignment."userId" AND membership."status" = 'active'
        JOIN "Role" target_role
          ON target_role."key" = 'legacy-' || coalesce(
              nullif(trim(both '-' from regexp_replace(lower(legacy_role."name"), '[^a-z0-9]+', '-', 'g')), ''),
              md5(legacy_role."id")
          )
        ON CONFLICT ("subjectId", "subjectType", "tenantId", "roleId") DO NOTHING;

        INSERT INTO "RoleAssignment" ("id", "subjectId", "subjectType", "tenantId", "roleId", "createdAt")
        SELECT
            'legacy_assignment_' || md5(legacy_assignment."userId" || ':unscoped:' || target_role."id"),
            legacy_assignment."userId",
            'user'::"SubjectType",
            'unscoped',
            target_role."id",
            CURRENT_TIMESTAMP
        FROM users."UserRole" legacy_assignment
        JOIN users."Role" legacy_role ON legacy_role."id" = legacy_assignment."roleId"
        JOIN "Role" target_role
          ON target_role."key" = 'legacy-' || coalesce(
              nullif(trim(both '-' from regexp_replace(lower(legacy_role."name"), '[^a-z0-9]+', '-', 'g')), ''),
              md5(legacy_role."id")
          )
        WHERE NOT EXISTS (
            SELECT 1
            FROM users."TenantMembership" membership
            WHERE membership."userId" = legacy_assignment."userId"
              AND membership."status" = 'active'
        )
        ON CONFLICT ("subjectId", "subjectType", "tenantId", "roleId") DO NOTHING;

        DROP SCHEMA users CASCADE;
    END IF;
END
$migration$;
