import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { AuthorizationService } from './authorization.service';
import {
  addParentRoleSchema,
  authorizeSchema,
  createObjectPermissionSchema,
  createRoleAssignmentSchema,
  createRoleSchema,
  grantPermissionSchema,
  registerPermissionSchema,
  registerResourceSchema,
} from './dto/authorization.dto';

@Controller()
export class AuthorizationController {
  constructor(private readonly authz: AuthorizationService) {}

  @Post('resources')
  async registerResource(@Body() body: unknown) {
    const parsed = registerResourceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.registerResource(parsed.data));
  }

  @Post('permissions')
  async registerPermission(@Body() body: unknown) {
    const parsed = registerPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.registerPermission(parsed.data));
  }

  @Get('resources')
  async listResources() {
    return envelope(await this.authz.listResources());
  }

  @Post('roles')
  async createRole(@Body() body: unknown) {
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createRole(parsed.data));
  }

  @Get('roles')
  async listRoles() {
    return envelope(await this.authz.listRoles());
  }

  @Post('roles/:roleId/permissions')
  async grantPermission(@Param('roleId') roleId: string, @Body() body: unknown) {
    const parsed = grantPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.grantPermission(roleId, parsed.data));
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  async revokePermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    await this.authz.revokePermission(roleId, permissionId);
    return envelope({ removed: true });
  }

  @Post('roles/:roleId/parents')
  async addParentRole(@Param('roleId') roleId: string, @Body() body: unknown) {
    const parsed = addParentRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.addParentRole(roleId, parsed.data));
  }

  @Delete('roles/:roleId/parents/:parentRoleId')
  async removeParentRole(@Param('roleId') roleId: string, @Param('parentRoleId') parentRoleId: string) {
    await this.authz.removeParentRole(roleId, parentRoleId);
    return envelope({ removed: true });
  }

  @Post('role-assignments')
  async createAssignment(@Body() body: unknown) {
    const parsed = createRoleAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createAssignment(parsed.data));
  }

  @Get('role-assignments')
  async listAssignments(@Query('subjectId') subjectId?: string) {
    return envelope(await this.authz.listAssignments(subjectId));
  }

  @Delete('role-assignments/:id')
  async removeAssignment(@Param('id') id: string) {
    await this.authz.removeAssignment(id);
    return envelope({ removed: true });
  }

  @Post('object-permissions')
  async createObjectPermission(@Body() body: unknown) {
    const parsed = createObjectPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createObjectPermission(parsed.data));
  }

  @Get('object-permissions')
  async listObjectPermissions(@Query('subjectId') subjectId?: string) {
    return envelope(await this.authz.listObjectPermissions(subjectId));
  }

  @Delete('object-permissions/:id')
  async removeObjectPermission(@Param('id') id: string) {
    await this.authz.removeObjectPermission(id);
    return envelope({ removed: true });
  }

  @Post('authorize')
  async authorize(@Body() body: unknown) {
    const parsed = authorizeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.authorize(parsed.data));
  }
}
