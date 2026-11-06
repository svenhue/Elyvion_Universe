import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { envelope, requireAuthorization } from '@elyvion/shared';
import { Request } from 'express';
import { createDeploymentSchema, createTargetSchema } from './dto/deployments.dto';
import { DeploymentsService } from './deployments.service';

@Controller()
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Post('deployment-targets')
  async createTarget(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment-target.create');
    const parsed = createTargetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.deployments.createTarget(parsed.data, activeTenantId));
  }

  @Get('deployment-targets')
  async listTargets(@Req() request: Request, @Headers('x-tenant-id') tenantId?: string) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment-target.read');
    return envelope(await this.deployments.listTargets(activeTenantId));
  }

  @Post('deployments')
  async deploy(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment.execute');
    const parsed = createDeploymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.deployments.deploy(parsed.data, activeTenantId));
  }

  @Get('deployments')
  async list(
    @Query('solutionKey') solutionKey: string | undefined,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment.read');
    return envelope(await this.deployments.list(activeTenantId, solutionKey));
  }

  @Get('deployments/:id')
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment.read', id);
    return envelope(await this.deployments.findOne(id, activeTenantId));
  }

  @Get('deployments/:id/status')
  async status(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment.read', id);
    return envelope(await this.deployments.getLiveStatus(id, activeTenantId));
  }

  @Post('deployments/:id/stop')
  async stop(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'development.deployment.stop', id);
    return envelope(await this.deployments.stop(id, activeTenantId));
  }
}

async function authorize(request: Request, tenantId: string, action: string, id?: string) {
  const requestId = request.headers['x-correlation-id'];
  return requireAuthorization({
    authorization: request.headers.authorization,
    tenantId,
    action,
    resource: { type: 'deployment-engine', id },
    requestId: typeof requestId === 'string' ? requestId : undefined,
  });
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required');
  return tenantId.trim();
}
