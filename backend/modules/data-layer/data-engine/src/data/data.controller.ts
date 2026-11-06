import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { envelope, requireAuthorization } from '@elyvion/shared';
import { Request } from 'express';
import { DataService } from './data.service';

@Controller('data')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get(':entity')
  async list(
    @Param('entity') entity: string,
    @Query() filter: Record<string, string>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    const obligations = await authorize(request, activeTenantId, 'data.record.read', entity);
    return envelope(await this.data.list(entity, activeTenantId, filter, obligations));
  }

  @Post(':entity')
  async create(
    @Param('entity') entity: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    const obligations = await authorize(request, activeTenantId, 'data.record.create', entity);
    return envelope(await this.data.create(entity, body, activeTenantId, obligations));
  }

  @Get(':entity/:id')
  async findOne(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    const obligations = await authorize(request, activeTenantId, 'data.record.read', entity, id);
    return envelope(await this.data.get(entity, id, activeTenantId, obligations));
  }

  @Patch(':entity/:id')
  async update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    const obligations = await authorize(request, activeTenantId, 'data.record.update', entity, id);
    return envelope(await this.data.update(entity, id, body, activeTenantId, obligations));
  }

  @Delete(':entity/:id')
  async remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    const obligations = await authorize(request, activeTenantId, 'data.record.delete', entity, id);
    await this.data.remove(entity, id, activeTenantId, obligations);
    return envelope({ removed: true });
  }
}

async function authorize(
  request: Request,
  tenantId: string,
  action: string,
  entity: string,
  id?: string,
) {
  const requestId = request.headers['x-correlation-id'];
  return requireAuthorization({
    authorization: request.headers.authorization,
    tenantId,
    action,
    resource: { type: 'data-engine', id: id ?? entity, attributes: { entity } },
    requestId: typeof requestId === 'string' ? requestId : undefined,
  });
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required');
  return tenantId.trim();
}
