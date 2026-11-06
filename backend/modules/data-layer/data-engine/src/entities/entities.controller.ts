import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { envelope, requireAuthorization } from '@elyvion/shared';
import { Request } from 'express';
import { createEntitySchema } from './dto/entities.dto';
import { EntityRegistryService } from './entity-registry.service';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly registry: EntityRegistryService) {}

  @Post()
  async create(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'data.entity.create');
    const parsed = createEntitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.registry.define(parsed.data, activeTenantId));
  }

  @Get()
  async list(@Req() request: Request, @Headers('x-tenant-id') tenantId?: string) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'data.entity.read');
    return envelope(await this.registry.list(activeTenantId));
  }

  @Get(':name')
  async findOne(
    @Param('name') name: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'data.entity.read', name);
    return envelope(await this.registry.get(name, activeTenantId));
  }

  @Delete(':name')
  async remove(
    @Param('name') name: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const activeTenantId = requireTenantId(tenantId);
    await authorize(request, activeTenantId, 'data.entity.delete', name);
    await this.registry.remove(name, activeTenantId);
    return envelope({ removed: true });
  }
}

async function authorize(request: Request, tenantId: string, action: string, id?: string) {
  const requestId = request.headers['x-correlation-id'];
  return requireAuthorization({
    authorization: request.headers.authorization,
    tenantId,
    action,
    resource: { type: 'data-engine', id, attributes: {} },
    requestId: typeof requestId === 'string' ? requestId : undefined,
  });
}

function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required');
  return tenantId.trim();
}
