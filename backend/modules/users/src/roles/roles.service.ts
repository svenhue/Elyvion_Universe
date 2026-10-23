import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllRoles() {
    return this.prisma.role.findMany({ include: { permissions: { include: { permission: true } } } });
  }

  createRole(name: string) {
    return this.prisma.role.create({ data: { name } });
  }

  findAllPermissions() {
    return this.prisma.permission.findMany();
  }

  createPermission(name: string) {
    return this.prisma.permission.create({ data: { name } });
  }

  async grantPermission(roleId: string, permissionId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`);
    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundException(`Permission "${permissionId}" not found`);

    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {},
    });
  }

  async assignRole(userId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`);

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async updateRole(id: string, name: string) {
    await this.requireRole(id);
    return this.prisma.role.update({ where: { id }, data: { name } });
  }

  async removeRole(id: string) {
    await this.requireRole(id);
    await this.prisma.role.delete({ where: { id } });
  }

  async updatePermission(id: string, name: string) {
    await this.requirePermission(id);
    return this.prisma.permission.update({ where: { id }, data: { name } });
  }

  async removePermission(id: string) {
    await this.requirePermission(id);
    await this.prisma.permission.delete({ where: { id } });
  }

  async revokePermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission
      .delete({ where: { roleId_permissionId: { roleId, permissionId } } })
      .catch(() => undefined);
  }

  async revokeRole(userId: string, roleId: string) {
    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } }).catch(() => undefined);
  }

  private async requireRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Role "${id}" not found`);
    return role;
  }

  private async requirePermission(id: string) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) throw new NotFoundException(`Permission "${id}" not found`);
    return permission;
  }
}
