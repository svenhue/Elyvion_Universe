import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { envelope, requireAuthorization, verifyBearerToken } from '@elyvion/shared';
import { Request } from 'express';
import { createAdapterSchema, deployAdapterSchema, scheduleAdapterSchema, updateAdapterSchema } from './dto/adapters.dto';
import { AdaptersService } from './adapters.service';
import { AdapterSecretScope } from './secret-store.client';

@Controller('adapters')
export class AdaptersController {
  constructor(private readonly adapters: AdaptersService) {}

  @Post()
  async create(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const parsed = createAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.create');
    await authorize(request, scope, 'data.adapter.secret.configure');
    return envelope(await this.adapters.create(parsed.data, {
      ...scope,
      ownerId: await getUserId(request),
      authorization: request.headers.authorization,
      requestId: requestId(request),
    }));
  }

  @Get()
  async list(
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.read');
    return envelope(await this.adapters.list(scope));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.read', id);
    return envelope(await this.adapters.findOne(id, scope));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const parsed = updateAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.update', id);
    return envelope(await this.adapters.update(id, parsed.data, scope));
  }

  @Patch(':id/schedule')
  async schedule(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const parsed = scheduleAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.update', id);
    return envelope(await this.adapters.schedule(id, parsed.data.schedule, scope));
  }

  @Post(':id/deploy')
  async deploy(
    @Param('id') targetAdapterId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const parsed = deployAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const targetScope = requireScope(tenantId, workspaceId, environmentId, targetAdapterId);
    const sourceScope = requireScope(
      tenantId,
      parsed.data.sourceWorkspaceId,
      parsed.data.sourceEnvironmentId,
      parsed.data.sourceAdapterId,
      false,
    );
    await authorize(request, sourceScope, 'data.adapter.deploy', parsed.data.sourceAdapterId);
    await authorize(request, targetScope, 'data.adapter.deploy', targetAdapterId);
    return envelope(await this.adapters.deploy(targetAdapterId, targetScope, sourceScope, parsed.data.sourceAdapterId));
  }

  @Get(':id/deployments')
  async listDeployments(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId, id);
    await authorize(request, scope, 'data.adapter.read', id);
    return envelope(await this.adapters.listDeployments(id, scope));
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId);
    await authorize(request, scope, 'data.adapter.delete', id);
    await this.adapters.remove(id, scope, request.headers.authorization, requestId(request));
    return envelope({ removed: true });
  }

  @Post(':id/test')
  async test(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId, id);
    await authorize(request, scope, 'data.adapter.test', id);
    return envelope(await this.adapters.triggerRun(id, scope, requestId(request)));
  }

  @Post(':id/runs')
  async triggerRun(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId, id);
    await authorize(request, scope, 'data.adapter.test', id);
    return envelope(await this.adapters.triggerRun(id, scope, requestId(request)));
  }

  @Get(':id/runs')
  async listRuns(
    @Param('id') id: string,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
    @Headers('x-workspace-id') workspaceId?: string,
    @Headers('x-environment-id') environmentId?: string,
  ) {
    const scope = requireScope(tenantId, workspaceId, environmentId, id);
    await authorize(request, scope, 'data.adapter.read', id);
    return envelope(await this.adapters.listRuns(id, scope));
  }
}

function requireScope(
  tenantId: string | undefined,
  workspaceId: string | undefined,
  environmentId: string | undefined,
  adapterId?: string,
  enforceRuntimeEnvironment = true,
): AdapterSecretScope {
  if (!tenantId?.trim() || !workspaceId?.trim() || !environmentId?.trim()) {
    throw new BadRequestException('x-tenant-id, x-workspace-id and x-environment-id are required.');
  }
  const runtimeEnvironmentId = process.env.DATA_ADAPTER_ENVIRONMENT_ID?.trim();
  if (enforceRuntimeEnvironment && (!runtimeEnvironmentId || environmentId.trim() !== runtimeEnvironmentId)) {
    throw new BadRequestException('The requested environment is not served by this Data Adapter runtime.');
  }
  return {
    tenantId: tenantId.trim(),
    workspaceId: workspaceId.trim(),
    environmentId: environmentId.trim(),
    adapterId: adapterId ?? '',
  };
}

async function authorize(
  request: Request,
  scope: AdapterSecretScope,
  action: string,
  id?: string,
): Promise<void> {
  await requireAuthorization({
    authorization: request.headers.authorization,
    tenantId: scope.tenantId,
    action,
    resource: {
      type: 'data-adapters',
      ...(id ? { id } : {}),
      attributes: {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        environmentId: scope.environmentId,
      },
    },
    requestId: requestId(request),
  });
}

async function getUserId(request: Request): Promise<string> {
  const payload = await verifyBearerToken(
    request.headers.authorization,
    process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011',
    process.env.API_AUDIENCE ?? 'elyvion:api',
  );
  if (!payload.sub) throw new BadRequestException('Token has no subject.');
  return payload.sub;
}

function requestId(request: Request): string | undefined {
  const id = request.headers['x-correlation-id'];
  return typeof id === 'string' ? id : undefined;
}
