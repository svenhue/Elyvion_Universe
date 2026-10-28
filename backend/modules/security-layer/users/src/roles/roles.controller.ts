import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { RolesService } from './roles.service';

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  async findAllRoles() {
    return envelope(await this.rolesService.findAllRoles());
  }

  @Post('roles')
  async createRole(@Body() body: { name: string }) {
    return envelope(await this.rolesService.createRole(body.name));
  }

  @Patch('roles/:id')
  async updateRole(@Param('id') id: string, @Body() body: { name: string }) {
    return envelope(await this.rolesService.updateRole(id, body.name));
  }

  @Delete('roles/:id')
  @HttpCode(204)
  async removeRole(@Param('id') id: string) {
    await this.rolesService.removeRole(id);
  }

  @Get('permissions')
  async findAllPermissions() {
    return envelope(await this.rolesService.findAllPermissions());
  }

  @Post('permissions')
  async createPermission(@Body() body: { name: string }) {
    return envelope(await this.rolesService.createPermission(body.name));
  }

  @Patch('permissions/:id')
  async updatePermission(@Param('id') id: string, @Body() body: { name: string }) {
    return envelope(await this.rolesService.updatePermission(id, body.name));
  }

  @Delete('permissions/:id')
  @HttpCode(204)
  async removePermission(@Param('id') id: string) {
    await this.rolesService.removePermission(id);
  }

  @Post('roles/:roleId/permissions/:permissionId')
  async grantPermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return envelope(await this.rolesService.grantPermission(roleId, permissionId));
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @HttpCode(204)
  async revokePermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    await this.rolesService.revokePermission(roleId, permissionId);
  }

  @Post('users/:userId/roles/:roleId')
  async assignRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return envelope(await this.rolesService.assignRole(userId, roleId));
  }

  @Delete('users/:userId/roles/:roleId')
  @HttpCode(204)
  async revokeRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    await this.rolesService.revokeRole(userId, roleId);
  }
}
