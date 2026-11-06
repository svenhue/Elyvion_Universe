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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { envelope, requireAuthorization, verifyBearerToken } from '@elyvion/shared';
import { Request } from 'express';
import { z } from 'zod';
import { OperatorTokenGuard } from '../authorization/operator-token.guard';
import { SecretActor, SecretScope, SecretsService } from './secrets.service';
import { WorkloadIdentityService } from './workload-identity.service';

const secretTypeSchema = z.enum(['password', 'api_key', 'token', 'private_key', 'oauth_client_secret']);
const scopeSchema = z.object({
  environmentId: z.string().min(1),
  workspaceId: z.string().min(1),
  adapterId: z.string().min(1),
});
const secretInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: secretTypeSchema,
  configKey: z.string().min(1),
  value: z.string().min(1).max(64_000),
  expiresAt: z.coerce.date().optional(),
});
const createSecretsSchema = scopeSchema.extend({
  secrets: z.array(secretInputSchema).min(1).max(20),
});
const rotateSecretSchema = z.object({ value: z.string().min(1).max(64_000) });
const updateSecretSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
}).refine((body) => Object.keys(body).length > 0);
const createReferenceSchema = scopeSchema.extend({
  secretId: z.string().min(1),
  configKey: z.string().min(1),
  versionPolicy: z.enum(['latest', 'pinned', 'required-minimum']).default('latest'),
  pinnedVersion: z.number().int().positive().optional(),
  requiredMinimum: z.number().int().positive().optional(),
});
const resolveSecretSchema = z.object({
  reference: z.string().startsWith('vault://'),
  tenantId: z.string().min(1),
  environmentId: z.string().min(1),
  workspaceId: z.string().min(1),
  adapterId: z.string().min(1),
});

@Controller('v1')
export class SecretsController {
  constructor(
    private readonly secrets: SecretsService,
    private readonly workloads: WorkloadIdentityService,
  ) {}

  @Post('secrets')
  async create(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = createSecretsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.create');
    await authorizeUser(request, scope, 'data.adapter.secret.configure', undefined, 'data-adapters');
    return envelope(await this.secrets.createBatch(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      parsed.data.secrets,
    ));
  }

  @Get('secrets')
  async list(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = scopeSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.read');
    return envelope(await this.secrets.list(scope));
  }

  @Get('secrets/audit')
  async listAudit(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = scopeSchema.extend({ limit: z.coerce.number().int().positive().optional() }).safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { limit, ...scopeInput } = parsed.data;
    const scope = getScope(tenantId, scopeInput);
    await authorizeUser(request, scope, 'security.secret.audit.read');
    return envelope(await this.secrets.listAudit(scope, limit));
  }

  @Get('secrets/:id')
  async get(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = scopeSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.read', id);
    return envelope(await this.secrets.get(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      id,
    ));
  }

  @Patch('secrets/:id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsedBody = updateSecretSchema.safeParse(body);
    const parsedScope = scopeSchema.safeParse(query);
    if (!parsedBody.success) throw new BadRequestException(parsedBody.error.issues);
    if (!parsedScope.success) throw new BadRequestException(parsedScope.error.issues);
    const scope = getScope(tenantId, parsedScope.data);
    await authorizeUser(request, scope, 'security.secret.update', id);
    return envelope(await this.secrets.updateMetadata(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      id,
      parsedBody.data,
    ));
  }

  @Post('secrets/:id/rotate')
  async rotate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsedBody = rotateSecretSchema.safeParse(body);
    const parsedScope = scopeSchema.safeParse(query);
    if (!parsedBody.success) throw new BadRequestException(parsedBody.error.issues);
    if (!parsedScope.success) throw new BadRequestException(parsedScope.error.issues);
    const scope = getScope(tenantId, parsedScope.data);
    await authorizeUser(request, scope, 'security.secret.rotate', id);
    return envelope(await this.secrets.rotate(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      id,
      parsedBody.data.value,
    ));
  }

  @Post('secrets/:id/disable')
  async disable(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = scopeSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.delete', id);
    return envelope(await this.secrets.disable(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      id,
    ));
  }

  @Delete('secrets/:id')
  async delete(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = scopeSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.delete', id);
    await this.secrets.delete(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      id,
    );
    return envelope({ removed: true });
  }

  @Post('secret-references')
  async createReference(
    @Body() body: unknown,
    @Req() request: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const parsed = createReferenceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const scope = getScope(tenantId, parsed.data);
    await authorizeUser(request, scope, 'security.secret.create');
    return envelope(await this.secrets.createReference(
      { ...scope, actorId: await getUserId(request), requestId: requestId(request) },
      parsed.data,
    ));
  }

  @Post('internal/secrets/resolve')
  async resolve(
    @Body() body: unknown,
    @Headers('x-workload-id') workloadId?: string,
    @Headers('x-workload-token') workloadToken?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const parsed = resolveSecretSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const identity = await this.workloads.authenticate(workloadId, workloadToken);
    const scope = { ...parsed.data, requestId: correlationId };
    const resolved = await this.secrets.resolve(identity, scope);
    return envelope(resolved);
  }

  @Post('operator/workspaces')
  @UseGuards(OperatorTokenGuard)
  async createWorkspace(@Body() body: unknown) {
    const parsed = z.object({ tenantId: z.string().min(1), name: z.string().trim().min(1).max(120) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.secrets.createWorkspace(parsed.data));
  }

  @Post('operator/workspaces/:workspaceId/members')
  @UseGuards(OperatorTokenGuard)
  async addWorkspaceMember(@Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    const parsed = z.object({ userId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.secrets.addWorkspaceMember(workspaceId, parsed.data.userId));
  }

  @Post('operator/environments')
  @UseGuards(OperatorTokenGuard)
  async createEnvironment(@Body() body: unknown) {
    const parsed = z.object({
      tenantId: z.string().min(1),
      key: z.enum(['development', 'staging', 'production']),
      name: z.string().trim().min(1).max(120),
    }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.secrets.createEnvironment(parsed.data));
  }
}

function getScope(tenantId: string | undefined, input: { environmentId: string; workspaceId: string; adapterId: string }): SecretScope {
  if (!tenantId?.trim()) throw new BadRequestException('x-tenant-id is required.');
  return { tenantId: tenantId.trim(), ...input };
}

async function authorizeUser(
  request: Request,
  scope: SecretScope,
  action: string,
  id?: string,
  resourceType = 'security',
): Promise<void> {
  await requireAuthorization({
    authorization: request.headers.authorization,
    tenantId: scope.tenantId,
    action,
    resource: {
      type: resourceType,
      ...(id ? { id } : {}),
      attributes: {
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        workspaceId: scope.workspaceId,
        adapterId: scope.adapterId,
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
    process.env.AUTH_JWKS_URL,
  );
  if (!payload.sub) throw new BadRequestException('Token has no subject.');
  return payload.sub;
}

function requestId(request: Request): string | undefined {
  const id = request.headers['x-correlation-id'];
  return typeof id === 'string' ? id : undefined;
}
