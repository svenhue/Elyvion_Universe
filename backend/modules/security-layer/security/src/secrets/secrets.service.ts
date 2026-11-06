import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, Secret, SecretReference, SecretVersion } from '../../generated/prisma';
import { RoleResolverService } from '../authorization/role-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecretValue, encryptSecretValue, validateSecretPlaintext } from './secret-crypto';
import { SecretWorkloadIdentity } from './workload-identity.service';

export type SecretType = 'password' | 'api_key' | 'token' | 'private_key' | 'oauth_client_secret';
export type SecretStatus = 'active' | 'disabled' | 'rotated' | 'deleted';

export interface CreateSecretInput {
  name: string;
  type: SecretType;
  configKey: string;
  value: string;
  expiresAt?: Date;
}

export interface SecretScope {
  tenantId: string;
  environmentId: string;
  workspaceId: string;
  adapterId: string;
}

export interface SecretActor extends SecretScope {
  actorId: string;
  requestId?: string;
}

@Injectable()
export class SecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roles: RoleResolverService,
  ) {}

  createWorkspace(input: { tenantId: string; name: string }) {
    return this.prisma.workspace.create({ data: input });
  }

  async addWorkspaceMember(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace was not found.');
    return this.prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, status: 'active' },
      update: { status: 'active' },
    });
  }

  createEnvironment(input: { tenantId: string; key: string; name: string }) {
    return this.prisma.environment.upsert({
      where: { tenantId_key: { tenantId: input.tenantId, key: input.key } },
      create: input,
      update: { name: input.name },
    });
  }

  async createBatch(
    actor: SecretActor,
    secrets: CreateSecretInput[],
  ): Promise<SecretMetadata[]> {
    if (secrets.length < 1 || secrets.length > 20) {
      throw new BadRequestException('Between 1 and 20 adapter secrets are required.');
    }
    const environment = await this.prisma.environment.findFirst({
      where: { id: actor.environmentId, tenantId: actor.tenantId },
    });
    if (!environment) throw new NotFoundException('Environment was not found for this tenant.');
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: actor.workspaceId, tenantId: actor.tenantId, status: 'active' },
    });
    if (!workspace) throw new NotFoundException('Workspace was not found for this tenant.');

    const prepared = await Promise.all(secrets.map(async (secret) => {
      const plaintext = validateSecretPlaintext(secret.value);
      const configKey = validateConfigKey(secret.configKey);
      return {
        secret,
        configKey,
        encrypted: await encryptSecretValue(plaintext),
        canonicalPath: secretReferencePath(actor, configKey),
      };
    }));

    const output = await this.prisma.$transaction(async (transaction) => {
      await transaction.secretStore.upsert({
        where: {
          tenantId_environmentId: {
            tenantId: actor.tenantId,
            environmentId: actor.environmentId,
          },
        },
        create: { tenantId: actor.tenantId, environmentId: actor.environmentId },
        update: {},
      });

      const results: SecretMetadata[] = [];
      for (const item of prepared) {
        const secret = await transaction.secret.create({
          data: {
            tenantId: actor.tenantId,
            environmentId: actor.environmentId,
            workspaceId: actor.workspaceId,
            adapterId: actor.adapterId,
            ownerId: actor.actorId,
            name: item.secret.name,
            type: item.secret.type,
            canonicalPath: item.canonicalPath,
            expiresAt: item.secret.expiresAt,
            versions: {
              create: {
                version: 1,
                ...item.encrypted,
                createdBy: actor.actorId,
              },
            },
            references: {
              create: {
                tenantId: actor.tenantId,
                environmentId: actor.environmentId,
                workspaceId: actor.workspaceId,
                adapterId: actor.adapterId,
                configKey: item.configKey,
                versionPolicy: 'latest',
                canonicalPath: item.canonicalPath,
              },
            },
          },
          include: { references: true },
        });
        await this.writeAudit(transaction, {
          actorId: actor.actorId,
          actorType: 'user',
          action: 'security.secret.create',
          outcome: 'success',
          requestId: actor.requestId,
          tenantId: actor.tenantId,
          environmentId: actor.environmentId,
          workspaceId: actor.workspaceId,
          adapterId: actor.adapterId,
          secretId: secret.id,
        });
        results.push({ ...toMetadata(secret, secret.references[0]), configKey: item.configKey });
      }
      return results;
    });
    return output;
  }

  async list(scope: SecretScope): Promise<SecretMetadata[]> {
    const secrets = await this.prisma.secret.findMany({
      where: scope,
      include: { references: true },
      orderBy: { updatedAt: 'desc' },
    });
    return secrets.map((secret) => toMetadata(secret, secret.references[0]));
  }

  async get(actor: SecretActor, secretId: string): Promise<SecretMetadata> {
    const secret = await this.findScoped(actor, secretId);
    await this.auditMetadataRead(actor, secret);
    return toMetadata(secret, secret.references[0]);
  }

  async createReference(
    actor: SecretActor,
    input: {
      secretId: string;
      configKey: string;
      versionPolicy: 'latest' | 'pinned' | 'required-minimum';
      pinnedVersion?: number;
      requiredMinimum?: number;
    },
  ): Promise<{ id: string; reference: string; versionPolicy: string }> {
    const secret = await this.findScoped(actor, input.secretId);
    if (secret.status === 'deleted') throw new NotFoundException('Secret was not found.');
    if (input.versionPolicy === 'pinned' && !input.pinnedVersion) {
      throw new BadRequestException('Pinned references require a pinnedVersion.');
    }
    if (input.versionPolicy === 'required-minimum' && !input.requiredMinimum) {
      throw new BadRequestException('required-minimum references require a requiredMinimum.');
    }
    const configKey = validateConfigKey(input.configKey);
    const canonicalPath = secretReferencePath(actor, configKey);
    return this.prisma.$transaction(async (transaction) => {
      const reference = await transaction.secretReference.create({
        data: {
          secretId: secret.id,
          tenantId: actor.tenantId,
          environmentId: actor.environmentId,
          workspaceId: actor.workspaceId,
          adapterId: actor.adapterId,
          configKey,
          versionPolicy: input.versionPolicy,
          pinnedVersion: input.pinnedVersion,
          requiredMinimum: input.requiredMinimum,
          canonicalPath,
        },
      });
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action: 'security.secret.create-reference',
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId: secret.id,
      });
      return {
        id: reference.id,
        reference: reference.canonicalPath,
        versionPolicy: reference.versionPolicy,
      };
    });
  }

  async updateMetadata(
    actor: SecretActor,
    secretId: string,
    input: { name?: string; expiresAt?: Date | null },
  ): Promise<SecretMetadata> {
    const secret = await this.findScoped(actor, secretId);
    if (secret.status === 'deleted') throw new NotFoundException('Secret was not found.');
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.secret.update({
        where: { id: secret.id },
        data: input,
        include: { references: true },
      });
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action: 'security.secret.update',
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId,
      });
      return result;
    });
    return toMetadata(updated, updated.references[0]);
  }

  async rotate(
    actor: SecretActor,
    secretId: string,
    value: string,
  ): Promise<SecretMetadata> {
    const secret = await this.findScoped(actor, secretId);
    if (secret.status === 'deleted') throw new NotFoundException('Secret was not found.');
    const encrypted = await encryptSecretValue(validateSecretPlaintext(value));

    const updated = await this.prisma.$transaction(async (transaction) => {
      const version = secret.currentVersion + 1;
      const result = await transaction.secret.update({
        where: { id: secret.id },
        data: {
          status: 'active',
          currentVersion: version,
          versions: {
            create: { version, ...encrypted, createdBy: actor.actorId },
          },
        },
        include: { references: true },
      });
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action: 'security.secret.rotate',
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId,
      });
      return result;
    });
    return toMetadata(updated, updated.references[0]);
  }

  async disable(actor: SecretActor, secretId: string): Promise<SecretMetadata> {
    return this.updateStatus(actor, secretId, 'disabled', 'security.secret.disable');
  }

  async delete(actor: SecretActor, secretId: string): Promise<void> {
    const secret = await this.findScoped(actor, secretId);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.secretVersion.deleteMany({ where: { secretId } });
      await transaction.secretReference.deleteMany({ where: { secretId } });
      await transaction.secret.update({ where: { id: secretId }, data: { status: 'deleted' } });
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action: 'security.secret.delete',
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId,
      });
    });
  }

  async resolve(
    actor: SecretWorkloadIdentity,
    scope: SecretScope & { reference: string; requestId?: string },
  ): Promise<{ value: string; metadata: Omit<SecretMetadata, 'reference'> }> {
    const reference = await this.prisma.secretReference.findFirst({
      where: {
        canonicalPath: scope.reference,
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        workspaceId: scope.workspaceId,
        adapterId: scope.adapterId,
      },
      include: { secret: { include: { versions: true } } },
    });
    if (!reference) {
      await this.writeWorkloadAudit(scope, actor.id, undefined, 'deny', 'reference_not_found');
      throw new NotFoundException('Secret reference was not found.');
    }
    if (!isWorkloadScopedTo(actor, reference)) {
      await this.writeWorkloadAudit(scope, actor.id, reference.secretId, 'deny', 'workload_scope_mismatch');
      throw new ForbiddenException('Workload is not authorized for this secret scope.');
    }
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: scope.workspaceId, tenantId: scope.tenantId, status: 'active' },
      select: { id: true },
    });
    if (!workspace) {
      await this.writeWorkloadAudit(scope, actor.id, reference.secretId, 'deny', 'workspace_inactive_or_missing');
      throw new ForbiddenException('Workspace is inactive or unavailable.');
    }
    const secret = reference.secret;
    if (secret.status !== 'active' || (secret.expiresAt && secret.expiresAt <= new Date())) {
      await this.writeWorkloadAudit(scope, actor.id, secret.id, 'deny', 'secret_inactive_or_expired');
      throw new ForbiddenException('Secret is inactive or expired.');
    }

    let versionNumber: number;
    try {
      versionNumber = selectVersion(reference, secret.currentVersion);
    } catch (error) {
      await this.writeWorkloadAudit(scope, actor.id, secret.id, 'deny', 'secret_version_policy_failed');
      throw error;
    }
    const version = secret.versions.find((candidate) => candidate.version === versionNumber);
    if (!version) {
      await this.writeWorkloadAudit(scope, actor.id, secret.id, 'deny', 'secret_version_unavailable');
      throw new NotFoundException('Required secret version was not found.');
    }

    const allowed = await this.authorizeWorkload(actor.id, scope, secret.id);
    if (!allowed) {
      await this.writeWorkloadAudit(scope, actor.id, secret.id, 'deny', 'permission_denied');
      throw new ForbiddenException('Workload is not authorized to use this secret.');
    }
    let value: string;
    try {
      if (version.algorithm !== 'aes-256-gcm') {
        throw new ServiceUnavailableException('Secret encryption algorithm is unsupported.');
      }
      value = await decryptSecretValue({ ...version, algorithm: 'aes-256-gcm' });
    } catch (error) {
      await this.writeWorkloadAudit(scope, actor.id, secret.id, 'deny', 'secret_decryption_failed');
      throw error;
    }
    await this.writeWorkloadAudit(scope, actor.id, secret.id, 'success', undefined);
    return { value, metadata: toMetadata(secret, reference, false) };
  }

  async listAudit(scope: SecretScope, limit = 100) {
    return this.prisma.secretAccessLog.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      select: {
        id: true,
        tenantId: true,
        environmentId: true,
        workspaceId: true,
        adapterId: true,
        secretId: true,
        actorId: true,
        actorType: true,
        action: true,
        outcome: true,
        reason: true,
        requestId: true,
        createdAt: true,
      },
    });
  }

  private async updateStatus(
    actor: SecretActor,
    secretId: string,
    status: 'disabled',
    action: string,
  ): Promise<SecretMetadata> {
    const secret = await this.findScoped(actor, secretId);
    const result = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.secret.update({
        where: { id: secretId },
        data: { status },
        include: { references: true },
      });
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action,
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId,
      });
      return updated;
    });
    return toMetadata(result, result.references[0]);
  }

  private async findScoped(actor: SecretScope, secretId: string) {
    const secret = await this.prisma.secret.findFirst({
      where: { id: secretId, ...actor },
      include: { references: true },
    });
    if (!secret) throw new NotFoundException('Secret was not found.');
    return secret;
  }

  private async auditMetadataRead(actor: SecretActor, secret: Secret): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.writeAudit(transaction, {
        actorId: actor.actorId,
        actorType: 'user',
        action: 'security.secret.read',
        outcome: 'success',
        requestId: actor.requestId,
        tenantId: actor.tenantId,
        environmentId: actor.environmentId,
        workspaceId: actor.workspaceId,
        adapterId: actor.adapterId,
        secretId: secret.id,
      });
    });
  }

  private async authorizeWorkload(
    workloadId: string,
    scope: SecretScope,
    secretId: string,
  ): Promise<boolean> {
    const roleIds = await this.roles.effectiveRoleIds(workloadId, 'agent', scope.tenantId);
    if (roleIds.length === 0) return false;
    const grants = await this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        permission: {
          key: 'security.secret.use',
          resource: { key: 'security' },
        },
      },
    });
    if (grants.length === 0) return false;
    await this.prisma.auditLog.create({
      data: {
        tenantId: scope.tenantId,
        action: 'security.secret.use',
        resourceType: 'secret',
        resourceId: secretId,
        decision: 'ALLOW',
        reason: 'Workload has tenant-scoped secret-use permission.',
        matchedPolicies: ['role:adapter-workload'],
        evaluatedPermissions: ['security.secret.use'],
        actorType: 'workload',
        workspaceId: scope.workspaceId,
        environmentId: scope.environmentId,
      },
    });
    return true;
  }

  private async writeWorkloadAudit(
    scope: SecretScope & { requestId?: string },
    workloadId: string,
    secretId: string | undefined,
    outcome: 'success' | 'deny',
    reason: string | undefined,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await this.writeAudit(transaction, {
        actorId: workloadId,
        actorType: 'workload',
        action: 'security.secret.use',
        outcome,
        reason,
        requestId: scope.requestId,
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        workspaceId: scope.workspaceId,
        adapterId: scope.adapterId,
        secretId,
      });
      await transaction.auditLog.create({
        data: {
          tenantId: scope.tenantId,
          action: 'security.secret.use',
          resourceType: 'secret',
          resourceId: secretId,
          decision: outcome === 'success' ? 'ALLOW' : 'DENY',
          reason: reason ?? 'Workload secret access.',
          matchedPolicies: [],
          evaluatedPermissions: ['security.secret.use'],
          actorType: 'workload',
          workspaceId: scope.workspaceId,
          environmentId: scope.environmentId,
        },
      });
    });
  }

  private async writeAudit(
    transaction: Prisma.TransactionClient,
    event: {
      actorId: string;
      actorType: string;
      action: string;
      outcome: string;
      reason?: string;
      requestId?: string;
      tenantId: string;
      environmentId?: string;
      workspaceId?: string;
      adapterId?: string;
      secretId?: string;
    },
  ): Promise<void> {
    await transaction.secretAccessLog.create({ data: event });
    await transaction.auditLog.create({
      data: {
        requestId: event.requestId,
        userId: event.actorType === 'user' ? event.actorId : undefined,
        tenantId: event.tenantId,
        action: event.action,
        resourceType: event.secretId ? 'secret' : 'secret-store',
        resourceId: event.secretId,
        decision: event.outcome === 'success' ? 'ALLOW' : 'DENY',
        reason: event.reason ?? event.action,
        matchedPolicies: [],
        evaluatedPermissions: [event.action],
        actorType: event.actorType,
        workspaceId: event.workspaceId,
        environmentId: event.environmentId,
      },
    });
  }
}

export interface SecretMetadata {
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  reference: string;
  configKey?: string;
}

function toMetadata(
  secret: Secret,
  reference?: SecretReference,
  includeReference = true,
): SecretMetadata {
  return {
    id: secret.id,
    name: secret.name,
    type: secret.type,
    status: secret.status,
    version: secret.currentVersion,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    expiresAt: secret.expiresAt,
    reference: includeReference ? reference?.canonicalPath ?? secret.canonicalPath : '',
  };
}

function validateConfigKey(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z][A-Za-z0-9_-]*)*$/.test(value)) {
    throw new BadRequestException('Secret config keys must be dot-separated identifiers.');
  }
  return value;
}

function secretReferencePath(scope: SecretScope, configKey: string): string {
  return `vault://tenants/${encodeURIComponent(scope.tenantId)}/environments/${encodeURIComponent(scope.environmentId)}/data-adapters/${encodeURIComponent(scope.adapterId)}/${configKey.replaceAll('.', '/')}`;
}

function isWorkloadScopedTo(identity: SecretWorkloadIdentity, reference: SecretReference): boolean {
  return identity.tenantIds.includes(reference.tenantId) &&
    identity.environmentIds.includes(reference.environmentId) &&
    !!reference.workspaceId && identity.workspaceIds.includes(reference.workspaceId) &&
    identity.adapterIds.includes(reference.adapterId);
}

function selectVersion(reference: SecretReference, currentVersion: number): number {
  switch (reference.versionPolicy) {
    case 'latest':
      return currentVersion;
    case 'pinned':
      if (!reference.pinnedVersion) throw new NotFoundException('Pinned secret version is not configured.');
      return reference.pinnedVersion;
    case 'required-minimum':
      if (!reference.requiredMinimum || currentVersion < reference.requiredMinimum) {
        throw new NotFoundException('Secret does not satisfy the required minimum version.');
      }
      return currentVersion;
    default:
      throw new BadRequestException('Secret reference has an unsupported version policy.');
  }
}
