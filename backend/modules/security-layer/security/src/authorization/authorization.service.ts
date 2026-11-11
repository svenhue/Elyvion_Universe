import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddParentRoleDto,
  AuthorizeDto,
  CreateObjectPermissionDto,
  CreateRoleAssignmentDto,
  CreateRoleDto,
  GrantTenantPermissionDto,
  RegisterPermissionDto,
  RegisterResourceDto,
  authorizationObligationsSchema,
} from './dto/authorization.dto';
import { RoleResolverService } from './role-resolver.service';

export interface AuthorizeResult {
  decision: 'ALLOW' | 'DENY';
  reason: string;
  matchedPolicies: string[];
  evaluatedPermissions: string[];
  obligations: {
    audit?: boolean;
    maskColumns?: string[];
    rowFilter?: Record<string, unknown>;
    requireMfa?: boolean;
    requireApproval?: boolean;
    maxRows?: number;
  };
}

export interface AuthorizationRequest extends AuthorizeDto {
  userId: string;
  tenantId: string;
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RoleResolverService,
  ) {}

  // --- Resources & permissions (self-registered by modules, like actions) ---

  registerResource(dto: RegisterResourceDto) {
    return this.prisma.resource.upsert({
      where: { key: dto.key },
      create: dto,
      update: { name: dto.name, description: dto.description },
    });
  }

  async registerPermission(dto: RegisterPermissionDto) {
    const resource = await this.prisma.resource.findUnique({ where: { key: dto.resourceKey } });
    if (!resource) throw new NotFoundException(`Resource "${dto.resourceKey}" wurde nicht gefunden.`);
    return this.prisma.permission.upsert({
      where: { resourceId_key: { resourceId: resource.id, key: dto.key } },
      create: { resourceId: resource.id, key: dto.key, name: dto.name, description: dto.description },
      update: { name: dto.name, description: dto.description },
    });
  }

  listResources() {
    return this.prisma.resource.findMany({ include: { permissions: true }, orderBy: { key: 'asc' } });
  }

  // --- Roles ---

  async createRole(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Rolle "${dto.key}" existiert bereits.`);
    return this.prisma.role.create({ data: dto });
  }

  listRoles() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, parentsOf: true },
      orderBy: { key: 'asc' },
    });
  }

  async grantTenantPermission(roleId: string, dto: GrantTenantPermissionDto) {
    await this.mustFindRole(roleId);
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: dto.permissionId } },
      create: {
        roleId,
        permissionId: dto.permissionId,
        obligations: dto.obligations,
      },
      update: { obligations: dto.obligations },
    });
  }

  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  }

  async addParentRole(roleId: string, dto: AddParentRoleDto) {
    await this.mustFindRole(roleId);
    await this.mustFindRole(dto.parentRoleId);
    await this.roles.assertNoCycle(roleId, dto.parentRoleId);
    return this.prisma.roleInheritance.upsert({
      where: { childRoleId_parentRoleId: { childRoleId: roleId, parentRoleId: dto.parentRoleId } },
      create: { childRoleId: roleId, parentRoleId: dto.parentRoleId },
      update: {},
    });
  }

  async removeParentRole(roleId: string, parentRoleId: string): Promise<void> {
    await this.prisma.roleInheritance.deleteMany({ where: { childRoleId: roleId, parentRoleId } });
  }

  private async mustFindRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Rolle "${roleId}" wurde nicht gefunden.`);
    return role;
  }

  // --- Role assignments (subject → role) ---

  createAssignment(dto: CreateRoleAssignmentDto) {
    return this.prisma.roleAssignment.upsert({
      where: {
        subjectId_subjectType_tenantId_roleId: {
          subjectId: dto.subjectId,
          subjectType: dto.subjectType,
          tenantId: dto.tenantId,
          roleId: dto.roleId,
        },
      },
      create: dto,
      update: {},
    });
  }

  async assignTenantRole(input: { subjectId: string; tenantId: string; roleKey: string }) {
    const role = await this.prisma.role.findUnique({ where: { key: input.roleKey } });
    if (!role) throw new NotFoundException(`Role "${input.roleKey}" not found`);
    return this.createAssignment({
      subjectId: input.subjectId,
      subjectType: 'user',
      tenantId: input.tenantId,
      roleId: role.id,
    });
  }

  listAssignments(subjectId?: string, tenantId?: string) {
    return this.prisma.roleAssignment.findMany({
      where: { ...(subjectId ? { subjectId } : {}), ...(tenantId ? { tenantId } : {}) },
      include: { role: true },
    });
  }

  async removeAssignment(id: string): Promise<void> {
    await this.prisma.roleAssignment.delete({ where: { id } });
  }

  // --- Object-level permissions (instance-level overrides) ---

  async createObjectPermission(dto: CreateObjectPermissionDto) {
    const permission = await this.findPermissionByKeys(dto.resourceKey, dto.permissionKey);
    if (!permission) {
      throw new NotFoundException(`Berechtigung "${dto.resourceKey}:${dto.permissionKey}" wurde nicht gefunden.`);
    }
    return this.prisma.objectPermission.upsert({
      where: {
        subjectId_subjectType_tenantId_permissionId_objectId: {
          subjectId: dto.subjectId,
          subjectType: dto.subjectType,
          tenantId: dto.tenantId,
          permissionId: permission.id,
          objectId: dto.objectId,
        },
      },
      create: {
        subjectId: dto.subjectId,
        subjectType: dto.subjectType,
        tenantId: dto.tenantId,
        permissionId: permission.id,
        objectId: dto.objectId,
        effect: dto.effect,
      },
      update: { effect: dto.effect },
    });
  }

  listObjectPermissions(subjectId?: string) {
    return this.prisma.objectPermission.findMany({
      where: subjectId ? { subjectId } : undefined,
      include: { permission: { include: { resource: true } } },
    });
  }

  async removeObjectPermission(id: string): Promise<void> {
    await this.prisma.objectPermission.delete({ where: { id } });
  }

  // --- The actual decision ---

  async authorize(request: AuthorizationRequest): Promise<AuthorizeResult> {
    const action = request.action;
    const resourceType = request.resource.type;
    const resourceId = request.resource.id ?? null;
    const evaluatedPermissions = [action];
    const assertedTenant = request.resource.attributes['tenantId'];
    const targetTenantId = typeof assertedTenant === 'string' ? assertedTenant : request.tenantId;
    const isSuperAdmin = await this.roles.hasSuperAdminRole(request.userId, 'user');
    let decision: AuthorizeResult;

    const tenantAccess = isSuperAdmin
      ? await this.hasTenant(targetTenantId)
      : await this.hasActiveMembership(request.userId, request.tenantId);
    if (!tenantAccess) {
      decision = deny(
        isSuperAdmin
          ? 'Target tenant does not exist.'
          : 'No active membership in the selected tenant.',
        evaluatedPermissions,
      );
    } else if (!isSuperAdmin && assertedTenant !== undefined && assertedTenant !== request.tenantId) {
      decision = deny('Resource belongs to a different tenant.', evaluatedPermissions);
    } else {
      const workspaceId = request.resource.attributes['workspaceId'];
      const workspaceAccess = isSuperAdmin || typeof workspaceId !== 'string' ||
        await this.hasActiveWorkspaceMembership(request.userId, targetTenantId, workspaceId);
      if (!workspaceAccess) {
        decision = deny('No active membership in the selected workspace.', evaluatedPermissions);
      } else {
        const permission = await this.findPermissionByKeys(resourceType, action);
        if (!permission) {
          decision = deny('Unknown permission.', evaluatedPermissions);
        } else if (isSuperAdmin) {
          decision = allow(
            'Permission granted by the platform super-admin role.',
            ['role:admin'],
            evaluatedPermissions,
          );
        } else {
          decision = await this.evaluateGrant(request, permission.id, evaluatedPermissions);
        }
      }
    }

    await this.prisma.auditLog.create({
      data: {
        requestId: request.context.requestId,
        userId: request.userId,
        tenantId: targetTenantId,
        action,
        resourceType,
        resourceId,
        decision: decision.decision,
        reason: decision.reason,
        matchedPolicies: decision.matchedPolicies,
        evaluatedPermissions: decision.evaluatedPermissions,
        obligations: JSON.parse(JSON.stringify(decision.obligations)) as Prisma.InputJsonValue,
      },
    });
    if (decision.decision === 'DENY') {
      this.logger.warn({
        userId: request.userId,
        tenantId: request.tenantId,
        action,
        resourceType,
        resourceId,
        reason: decision.reason,
      }, 'Authorization denied');
    }
    return decision;
  }

  private async evaluateGrant(
    request: AuthorizationRequest,
    permissionId: string,
    evaluatedPermissions: string[],
  ): Promise<AuthorizeResult> {
    if (request.resource.id) {
      const rule = await this.prisma.objectPermission.findUnique({
        where: {
          subjectId_subjectType_tenantId_permissionId_objectId: {
            subjectId: request.userId,
            subjectType: 'user',
            tenantId: request.tenantId,
            permissionId,
            objectId: request.resource.id,
          },
        },
      });
      if (rule?.effect === 'deny') return deny('Explicitly denied for this resource.', evaluatedPermissions);
      if (rule?.effect === 'allow') return allow('Explicit resource grant.', [], evaluatedPermissions);
    }

    const roleIds = await this.roles.effectiveRoleIds(request.userId, 'user', request.tenantId);
    if (!roleIds.length) return deny('No role assignment in the selected tenant.', evaluatedPermissions);
    const grant = await this.prisma.rolePermission.findFirst({
      where: { roleId: { in: roleIds }, permissionId },
      include: { role: { select: { key: true } } },
    });
    if (!grant) return deny('No matching permission grant.', evaluatedPermissions);

    const parsedObligations = authorizationObligationsSchema.safeParse(grant.obligations ?? {});
    if (!parsedObligations.success) return deny('Permission grant contains invalid obligations.', evaluatedPermissions);
    return allow(
      'Permission granted by tenant-scoped role.',
      [`role:${grant.role.key}`],
      evaluatedPermissions,
      parsedObligations.data,
    );
  }

  private async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        status: 'active',
        tenant: { status: 'active' },
      },
      select: { id: true },
    });
    return !!membership;
  }

  private async hasTenant(tenantId: string): Promise<boolean> {
    return !!(await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    }));
  }

  private async hasActiveWorkspaceMembership(
    userId: string,
    tenantId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        workspaceId,
        status: 'active',
        workspace: { tenantId },
      },
      select: { id: true },
    });
    return !!membership;
  }

  private async findPermissionByKeys(resourceKey: string, permissionKey: string) {
    const resource = await this.prisma.resource.findUnique({ where: { key: resourceKey } });
    if (!resource) return null;
    const permission = await this.prisma.permission.findUnique({
      where: { resourceId_key: { resourceId: resource.id, key: permissionKey } },
    });
    if (!permission) return null;
    return permission;
  }
}

function deny(reason: string, evaluatedPermissions: string[] = []): AuthorizeResult {
  return {
    decision: 'DENY',
    reason,
    matchedPolicies: [],
    evaluatedPermissions,
    obligations: {},
  };
}

function allow(
  reason: string,
  matchedPolicies: string[],
  evaluatedPermissions: string[],
  obligations: AuthorizeResult['obligations'] = {},
): AuthorizeResult {
  return { decision: 'ALLOW', reason, matchedPolicies, evaluatedPermissions, obligations };
}
