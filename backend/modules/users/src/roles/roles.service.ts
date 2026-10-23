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
}
