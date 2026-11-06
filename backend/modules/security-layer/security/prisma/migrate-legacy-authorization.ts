import { readFile } from 'node:fs/promises';
import { PrismaClient as SecurityPrismaClient } from '../generated/prisma';
import { PrismaClient as UsersPrismaClient } from '../../users/generated/prisma';

interface LegacyAuthorizationMapping {
  users: Record<string, string>;
  permissions: Record<string, { resourceKey: string; resourceName?: string; key: string; name?: string }>;
  roles?: Record<string, string>;
}

async function main(): Promise<void> {
  const usersDatabaseUrl = process.env.USERS_DATABASE_URL;
  const securityDatabaseUrl = process.env.DATABASE_URL;
  const mappingPath = process.env.LEGACY_AUTH_MAPPING_FILE;
  if (!usersDatabaseUrl || !securityDatabaseUrl || !mappingPath) {
    throw new Error('USERS_DATABASE_URL, DATABASE_URL, and LEGACY_AUTH_MAPPING_FILE are required');
  }

  const mapping = JSON.parse(await readFile(mappingPath, 'utf8')) as LegacyAuthorizationMapping;
  validateMapping(mapping);

  const users = new UsersPrismaClient({ datasources: { db: { url: usersDatabaseUrl } } });
  const security = new SecurityPrismaClient({ datasources: { db: { url: securityDatabaseUrl } } });

  try {
    const userRecords = await users.user.findMany({
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });
    const tenantByUserId = new Map<string, string>();
    for (const [email, tenantId] of Object.entries(mapping.users)) {
      const user = userRecords.find((record) => record.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error(`Mapped user "${email}" does not exist`);
      const membership = await users.tenantMembership.findFirst({
        where: { userId: user.id, tenantId, status: 'active', tenant: { status: 'active' } },
        select: { id: true },
      });
      if (!membership) throw new Error(`User "${email}" is not an active member of tenant "${tenantId}"`);
      tenantByUserId.set(user.id, tenantId);
    }

    const roleIds = new Map<string, string>();
    const permissionIds = new Map<string, string>();
    const legacyRoles = await users.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });

    for (const legacyPermission of uniquePermissions(legacyRoles)) {
      const permissionMapping = mapping.permissions[legacyPermission.name];
      if (!permissionMapping) {
        throw new Error(`Missing permission mapping for legacy permission "${legacyPermission.name}"`);
      }
      const resource = await security.resource.upsert({
        where: { key: permissionMapping.resourceKey },
        create: {
          key: permissionMapping.resourceKey,
          name: permissionMapping.resourceName ?? permissionMapping.resourceKey,
        },
        update: {},
      });
      const permission = await security.permission.upsert({
        where: { resourceId_key: { resourceId: resource.id, key: permissionMapping.key } },
        create: {
          resourceId: resource.id,
          key: permissionMapping.key,
          name: permissionMapping.name ?? legacyPermission.name,
        },
        update: {},
      });
      permissionIds.set(legacyPermission.id, permission.id);
    }

    for (const legacyRole of legacyRoles) {
      const roleKey = mapping.roles?.[legacyRole.name] ?? `legacy-${slug(legacyRole.name)}`;
      const role = await security.role.upsert({
        where: { key: roleKey },
        create: { key: roleKey, name: legacyRole.name },
        update: {},
      });
      roleIds.set(legacyRole.id, role.id);
      for (const grant of legacyRole.permissions) {
        const permissionId = permissionIds.get(grant.permissionId);
        if (!permissionId) throw new Error(`Permission "${grant.permission.name}" was not imported`);
        await security.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          create: { roleId: role.id, permissionId },
          update: {},
        });
      }
    }

    for (const user of userRecords) {
      const tenantId = tenantByUserId.get(user.id);
      if (!tenantId) continue;
      for (const assignment of user.roles) {
        const roleId = roleIds.get(assignment.roleId);
        if (!roleId) throw new Error(`Role "${assignment.role.name}" was not imported`);
        await security.roleAssignment.upsert({
          where: {
            subjectId_subjectType_tenantId_roleId: {
              subjectId: user.id,
              subjectType: 'user',
              tenantId,
              roleId,
            },
          },
          create: { subjectId: user.id, subjectType: 'user', tenantId, roleId },
          update: {},
        });
      }
    }

    const legacyAssignments = await security.roleAssignment.findMany({
      where: { subjectType: 'user', tenantId: 'unscoped' },
    });
    for (const assignment of legacyAssignments) {
      const tenantId = tenantByUserId.get(assignment.subjectId);
      if (!tenantId) continue;
      await security.roleAssignment.upsert({
        where: {
          subjectId_subjectType_tenantId_roleId: {
            subjectId: assignment.subjectId,
            subjectType: 'user',
            tenantId,
            roleId: assignment.roleId,
          },
        },
        create: {
          subjectId: assignment.subjectId,
          subjectType: 'user',
          tenantId,
          roleId: assignment.roleId,
        },
        update: {},
      });
      await security.roleAssignment.delete({ where: { id: assignment.id } });
    }

    const legacyObjectPermissions = await security.objectPermission.findMany({
      where: { subjectType: 'user', tenantId: 'unscoped' },
    });
    for (const permission of legacyObjectPermissions) {
      const tenantId = tenantByUserId.get(permission.subjectId);
      if (!tenantId) continue;
      await security.objectPermission.upsert({
        where: {
          subjectId_subjectType_tenantId_permissionId_objectId: {
            subjectId: permission.subjectId,
            subjectType: 'user',
            tenantId,
            permissionId: permission.permissionId,
            objectId: permission.objectId,
          },
        },
        create: {
          subjectId: permission.subjectId,
          subjectType: 'user',
          tenantId,
          permissionId: permission.permissionId,
          objectId: permission.objectId,
          effect: permission.effect,
        },
        update: { effect: permission.effect },
      });
      await security.objectPermission.delete({ where: { id: permission.id } });
    }

    console.log(`Migrated ${legacyRoles.length} legacy roles and mapped tenant memberships.`);
  } finally {
    await Promise.all([users.$disconnect(), security.$disconnect()]);
  }
}

function uniquePermissions(
  roles: Array<{ permissions: Array<{ permission: { id: string; name: string } }> }>,
) {
  const permissions = new Map<string, { id: string; name: string }>();
  for (const role of roles) {
    for (const grant of role.permissions) permissions.set(grant.permission.id, grant.permission);
  }
  return [...permissions.values()];
}

function validateMapping(mapping: LegacyAuthorizationMapping): void {
  if (!mapping || typeof mapping !== 'object' || !mapping.users || !mapping.permissions) {
    throw new Error('Mapping file must contain "users" and "permissions" objects');
  }
  if (Object.values(mapping.users).some((tenantId) => typeof tenantId !== 'string' || !tenantId.trim())) {
    throw new Error('Every mapped user must have a non-empty tenant ID');
  }
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!normalized) throw new Error(`Role name "${value}" cannot be converted to a role key`);
  return normalized;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
