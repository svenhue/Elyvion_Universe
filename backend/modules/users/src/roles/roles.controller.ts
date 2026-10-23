import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Get('permissions')
  async findAllPermissions() {
    return envelope(await this.rolesService.findAllPermissions());
  }

  @Post('permissions')
  async createPermission(@Body() body: { name: string }) {
    return envelope(await this.rolesService.createPermission(body.name));
  }

  @Post('roles/:roleId/permissions/:permissionId')
  async grantPermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    return envelope(await this.rolesService.grantPermission(roleId, permissionId));
  }

  @Post('users/:userId/roles/:roleId')
  async assignRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    return envelope(await this.rolesService.assignRole(userId, roleId));
  }
}
