import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddParentRoleDto,
  AuthorizeDto,
  CreateObjectPermissionDto,
  CreateRoleAssignmentDto,
  CreateRoleDto,
  GrantPermissionDto,
  RegisterPermissionDto,
  RegisterResourceDto,
} from './dto/authorization.dto';
import { RoleResolverService } from './role-resolver.service';

export interface AuthorizeResult {
  allowed: boolean;
  reason: string;
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

  async grantPermission(roleId: string, dto: GrantPermissionDto) {
    await this.mustFindRole(roleId);
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: dto.permissionId } },
      create: { roleId, permissionId: dto.permissionId },
      update: {},
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
      where: { subjectId_roleId: { subjectId: dto.subjectId, roleId: dto.roleId } },
      create: dto,
      update: {},
    });
  }

  listAssignments(subjectId?: string) {
    return this.prisma.roleAssignment.findMany({ where: subjectId ? { subjectId } : undefined, include: { role: true } });
  }

  async removeAssignment(id: string): Promise<void> {
    await this.prisma.roleAssignment.delete({ where: { id } });
  }

  // --- Object-level permissions (instance-level overrides) ---

  async createObjectPermission(dto: CreateObjectPermissionDto) {
    const permission = await this.findPermissionByKeys(dto.resourceKey, dto.permissionKey);
    return this.prisma.objectPermission.upsert({
      where: { subjectId_permissionId_objectId: { subjectId: dto.subjectId, permissionId: permission.id, objectId: dto.objectId } },
      create: {
        subjectId: dto.subjectId,
        subjectType: dto.subjectType,
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

  /**
   * Resolution order: no subject context → allow (actions-engine doesn't
   * thread a real identity through yet; see README) → an object-level
   * `deny` for this exact object always wins, as a pure blacklist on top
   * of whatever the role grants → otherwise, a role grant on the
   * permission allows it (the object-level rules for *other* objects
   * never affect this one — each rule is local to its own object) → if
   * no role grants it, an object-level `allow` for this exact object can
   * still grant it on its own, e.g. for a subject whose role doesn't cover
   * this permission at all but who should see a handful of objects.
   */
  async authorize(dto: AuthorizeDto): Promise<AuthorizeResult> {
    if (!dto.subjectId || !dto.subjectType) {
      return { allowed: true, reason: 'no subject context provided — default allow until identity propagation is wired in' };
    }

    const permission = await this.findPermissionByKeys(dto.resourceKey, dto.permissionKey).catch(() => null);
    if (!permission) {
      this.logger.warn(`Unknown permission "${dto.resourceKey}:${dto.permissionKey}" — denying by default.`);
      return { allowed: false, reason: `Unbekannte Berechtigung "${dto.resourceKey}:${dto.permissionKey}".` };
    }

    let objectDeny = false;
    let objectAllow = false;
    if (dto.objectId) {
      const rule = await this.prisma.objectPermission.findUnique({
        where: { subjectId_permissionId_objectId: { subjectId: dto.subjectId, permissionId: permission.id, objectId: dto.objectId } },
      });
      objectDeny = rule?.effect === 'deny';
      objectAllow = rule?.effect === 'allow';
    }
    if (objectDeny) return { allowed: false, reason: 'Explizit auf Objekt-Ebene verweigert.' };

    const roleIds = await this.roles.effectiveRoleIds(dto.subjectId, dto.subjectType);
    const grant = roleIds.length
      ? await this.prisma.rolePermission.findFirst({ where: { roleId: { in: roleIds }, permissionId: permission.id } })
      : null;
    if (grant) return { allowed: true, reason: 'Durch Rolle gewährt.' };
    if (objectAllow) return { allowed: true, reason: 'Explizit auf Objekt-Ebene erlaubt.' };
    return { allowed: false, reason: 'Keine zugewiesene Rolle und keine Objekt-Freigabe.' };
  }

  private async findPermissionByKeys(resourceKey: string, permissionKey: string) {
    const resource = await this.prisma.resource.findUnique({ where: { key: resourceKey } });
    if (!resource) throw new NotFoundException(`Resource "${resourceKey}" wurde nicht gefunden.`);
    const permission = await this.prisma.permission.findUnique({
      where: { resourceId_key: { resourceId: resource.id, key: permissionKey } },
    });
    if (!permission) throw new NotFoundException(`Berechtigung "${resourceKey}:${permissionKey}" wurde nicht gefunden.`);
    return permission;
  }
}
