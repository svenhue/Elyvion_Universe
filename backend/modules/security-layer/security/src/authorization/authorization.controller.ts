import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { envelope, verifyBearerToken } from '@elyvion/shared';
import { Request } from 'express';
import { AuthorizationService } from './authorization.service';
import {
  addParentRoleSchema,
  authorizeSchema,
  createObjectPermissionSchema,
  createRoleAssignmentSchema,
  createRoleSchema,
  grantTenantPermissionSchema,
  registerPermissionSchema,
  registerResourceSchema,
} from './dto/authorization.dto';
import { OperatorTokenGuard } from './operator-token.guard';

@Controller()
export class AuthorizationController {
  constructor(private readonly authz: AuthorizationService) {}

  @Post('resources')
  @UseGuards(OperatorTokenGuard)
  async registerResource(@Body() body: unknown) {
    const parsed = registerResourceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.registerResource(parsed.data));
  }

  @Post('permissions')
  @UseGuards(OperatorTokenGuard)
  async registerPermission(@Body() body: unknown) {
    const parsed = registerPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.registerPermission(parsed.data));
  }

  @Get('resources')
  @UseGuards(OperatorTokenGuard)
  async listResources() {
    return envelope(await this.authz.listResources());
  }

  @Post('roles')
  @UseGuards(OperatorTokenGuard)
  async createRole(@Body() body: unknown) {
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createRole(parsed.data));
  }

  @Get('roles')
  @UseGuards(OperatorTokenGuard)
  async listRoles() {
    return envelope(await this.authz.listRoles());
  }

  @Post('roles/:roleId/permissions')
  @UseGuards(OperatorTokenGuard)
  async grantPermission(@Param('roleId') roleId: string, @Body() body: unknown) {
    const parsed = grantTenantPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.grantTenantPermission(roleId, parsed.data));
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @UseGuards(OperatorTokenGuard)
  async revokePermission(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    await this.authz.revokePermission(roleId, permissionId);
    return envelope({ removed: true });
  }

  @Post('roles/:roleId/parents')
  @UseGuards(OperatorTokenGuard)
  async addParentRole(@Param('roleId') roleId: string, @Body() body: unknown) {
    const parsed = addParentRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.addParentRole(roleId, parsed.data));
  }

  @Delete('roles/:roleId/parents/:parentRoleId')
  @UseGuards(OperatorTokenGuard)
  async removeParentRole(@Param('roleId') roleId: string, @Param('parentRoleId') parentRoleId: string) {
    await this.authz.removeParentRole(roleId, parentRoleId);
    return envelope({ removed: true });
  }

  @Post('role-assignments')
  @UseGuards(OperatorTokenGuard)
  async createAssignment(@Body() body: unknown) {
    const parsed = createRoleAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createAssignment(parsed.data));
  }

  @Post('operator/tenant-assignments')
  @UseGuards(OperatorTokenGuard)
  async assignTenantRole(@Body() body: unknown) {
    const parsed = tenantRoleAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.assignTenantRole(parsed.data));
  }

  @Get('role-assignments')
  @UseGuards(OperatorTokenGuard)
  async listAssignments(@Query('subjectId') subjectId?: string, @Query('tenantId') tenantId?: string) {
    return envelope(await this.authz.listAssignments(subjectId, tenantId));
  }

  @Delete('role-assignments/:id')
  @UseGuards(OperatorTokenGuard)
  async removeAssignment(@Param('id') id: string) {
    await this.authz.removeAssignment(id);
    return envelope({ removed: true });
  }

  @Post('object-permissions')
  @UseGuards(OperatorTokenGuard)
  async createObjectPermission(@Body() body: unknown) {
    const parsed = createObjectPermissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.authz.createObjectPermission(parsed.data));
  }

  @Get('object-permissions')
  @UseGuards(OperatorTokenGuard)
  async listObjectPermissions(@Query('subjectId') subjectId?: string) {
    return envelope(await this.authz.listObjectPermissions(subjectId));
  }

  @Delete('object-permissions/:id')
  @UseGuards(OperatorTokenGuard)
  async removeObjectPermission(@Param('id') id: string) {
    await this.authz.removeObjectPermission(id);
    return envelope({ removed: true });
  }

  @Post('v1/authorize')
  async authorize(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId: string | undefined,
  ) {
    const parsed = authorizeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required');

    let userId: string | undefined;
    try {
      const payload = await verifyBearerToken(
        request.headers.authorization,
        process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011',
        process.env.API_AUDIENCE ?? 'elyvion:api',
        process.env.AUTH_JWKS_URL,
      );
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!userId) throw new UnauthorizedException('Token has no subject');

    const correlationId = request.headers['x-correlation-id'];
    return envelope(await this.authz.authorize({
      ...parsed.data,
      userId,
      tenantId,
      context: {
        ...parsed.data.context,
        requestId: parsed.data.context.requestId ??
          (typeof correlationId === 'string' ? correlationId : undefined),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    }));
  }
}

const tenantRoleAssignmentSchema = createRoleAssignmentSchema.pick({
  subjectId: true,
  tenantId: true,
}).extend({ roleKey: createRoleSchema.shape.key });
