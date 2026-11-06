import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { envelope, verifyBearerToken } from '@elyvion/shared';
import { Request } from 'express';
import { z } from 'zod';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';

const workspaceNameSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

@Controller('v1/workspaces')
export class WorkspacesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get()
  async list(@Req() request: Request, @Headers('x-tenant-id') tenantId?: string) {
    const actor = await this.authorize(request, tenantId, 'workspace.read');
    return envelope(await this.prisma.workspace.findMany({
      where: { tenantId: actor.tenantId, status: 'active' },
      select: { id: true, tenantId: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    }));
  }

  @Post()
  async create(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = workspaceNameSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const actor = await this.authorize(request, tenantId, 'workspace.create');
    try {
      const workspace = await this.prisma.workspace.create({
        data: {
          tenantId: actor.tenantId,
          name: parsed.data.name,
          memberships: { create: { userId: actor.userId } },
        },
        select: { id: true, tenantId: true, name: true, createdAt: true, updatedAt: true },
      });
      return envelope(workspace);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A workspace with this name already exists in the tenant.');
      }
      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = workspaceNameSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const actor = await this.authorize(request, tenantId, 'workspace.update');
    await this.mustFindWorkspace(actor.tenantId, id);
    try {
      const workspace = await this.prisma.workspace.update({
        where: { id },
        data: { name: parsed.data.name },
        select: { id: true, tenantId: true, name: true, createdAt: true, updatedAt: true },
      });
      if (workspace.tenantId !== actor.tenantId) throw new NotFoundException('Workspace not found.');
      return envelope(workspace);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A workspace with this name already exists in the tenant.');
      }
      throw error;
    }
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const actor = await this.authorize(request, tenantId, 'workspace.delete');
    await this.mustFindWorkspace(actor.tenantId, id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.workspaceMembership.updateMany({
        where: { workspaceId: id, status: 'active' },
        data: { status: 'revoked' },
      });
      await transaction.workspace.update({ where: { id }, data: { status: 'deleted' } });
    });
    return envelope({ removed: true });
  }

  private async authorize(request: Request, tenantId: string | undefined, action: string) {
    const scopedTenantId = tenantId?.trim();
    if (!scopedTenantId) throw new BadRequestException('x-tenant-id is required.');

    let payload: { sub?: string };
    try {
      payload = await verifyBearerToken(
        request.headers.authorization,
        process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011',
        process.env.API_AUDIENCE ?? 'elyvion:api',
        process.env.AUTH_JWKS_URL,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    if (!payload.sub) throw new UnauthorizedException('Token has no subject.');

    const result = await this.authorization.authorize({
      action,
      resource: {
        type: 'workspace-management',
        attributes: { tenantId: scopedTenantId },
      },
      context: {
        requestId: requestId(request),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      userId: payload.sub,
      tenantId: scopedTenantId,
    });
    if (result.decision !== 'ALLOW') throw new ForbiddenException('Workspace permission denied.');
    return { tenantId: scopedTenantId, userId: payload.sub };
  }

  private async mustFindWorkspace(tenantId: string, id: string) {
    const workspace = await this.prisma.workspace.findFirst({ where: { id, tenantId, status: 'active' } });
    if (!workspace) throw new NotFoundException('Workspace not found.');
    return workspace;
  }
}

function requestId(request: Request): string | undefined {
  const value = request.headers['x-correlation-id'];
  return typeof value === 'string' ? value : undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
}
