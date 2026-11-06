import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { RoleResolverService } from '../authorization/role-resolver.service';
import { SecretActor, SecretsService, SecretScope } from './secrets.service';
import { SecretWorkloadIdentity } from './workload-identity.service';

describe('SecretsService', () => {
  let directory = '';
  let service: SecretsService;
  let prisma: {
    environment: { findFirst: jest.Mock };
    workspace: { findFirst: jest.Mock };
    secretReference: { findFirst: jest.Mock };
    rolePermission: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let roles: { effectiveRoleIds: jest.Mock };
  let transaction: {
    secretStore: { upsert: jest.Mock };
    secretAccessLog: { create: jest.Mock };
    auditLog: { create: jest.Mock };
    secret: { create: jest.Mock };
  };
  const previousKeysFile = process.env.SECRET_STORE_KEYS_FILE;
  const previousActiveVersion = process.env.SECRET_STORE_ACTIVE_KEY_VERSION;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'elyvion-secret-service-test-'));
    process.env.SECRET_STORE_KEYS_FILE = join(directory, 'keys.json');
    process.env.SECRET_STORE_ACTIVE_KEY_VERSION = 'v1';
    await writeFile(
      process.env.SECRET_STORE_KEYS_FILE,
      JSON.stringify({ v1: Buffer.alloc(32, 3).toString('base64') }),
      { mode: 0o600 },
    );

    transaction = {
      secretStore: { upsert: jest.fn().mockResolvedValue({}) },
      secretAccessLog: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      secret: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'secret-1',
          ...data,
          status: 'active',
          currentVersion: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          references: [{ canonicalPath: data.canonicalPath }],
        })),
      },
    };
    prisma = {
      environment: { findFirst: jest.fn().mockResolvedValue({ id: 'environment-dev', tenantId: 'tenant-a' }) },
      workspace: { findFirst: jest.fn().mockResolvedValue({ id: 'workspace-a', tenantId: 'tenant-a' }) },
      secretReference: { findFirst: jest.fn() },
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    roles = { effectiveRoleIds: jest.fn().mockResolvedValue([]) };
    service = new SecretsService(
      prisma as unknown as PrismaService,
      roles as unknown as RoleResolverService,
    );
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    restoreEnvironment('SECRET_STORE_KEYS_FILE', previousKeysFile);
    restoreEnvironment('SECRET_STORE_ACTIVE_KEY_VERSION', previousActiveVersion);
  });

  it('persists encrypted secret material and returns metadata without the submitted value', async () => {
    const plaintext = 'must-never-appear-in-metadata-or-database';

    const result = await service.createBatch(actor, [{
      name: 'API credential',
      type: 'api_key',
      configKey: 'headers.apiKey',
      value: plaintext,
    }]);

    const persistedData = transaction.secret.create.mock.calls[0][0].data;
    expect(persistedData.versions.create.ciphertext).not.toContain(plaintext);
    expect(JSON.stringify(persistedData)).not.toContain(plaintext);
    expect(JSON.stringify(result)).not.toContain(plaintext);
    expect(result[0]).toMatchObject({
      name: 'API credential',
      type: 'api_key',
      status: 'active',
      version: 1,
      reference: expect.stringContaining('vault://tenants/tenant-a/environments/environment-dev'),
    });
    expect(transaction.secretAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: 'user',
          action: 'security.secret.create',
          outcome: 'success',
        }),
      }),
    );
  });

  it('does not create secrets outside the tenant-scoped environment', async () => {
    (prisma.environment.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.createBatch(actor, [{
      name: 'API credential',
      type: 'api_key',
      configKey: 'headers.apiKey',
      value: 'sensitive-input',
    }])).rejects.toThrow('Environment was not found for this tenant.');

    expect(transaction.secret.create).not.toHaveBeenCalled();
  });

  it('denies a workload whose environment allowlist does not include the reference environment', async () => {
    prisma.secretReference.findFirst.mockResolvedValue({
      id: 'reference-1',
      secretId: 'secret-1',
      tenantId: 'tenant-a',
      environmentId: 'environment-dev',
      workspaceId: 'workspace-a',
      adapterId: 'adapter-a',
      configKey: 'headers.apiKey',
      versionPolicy: 'latest',
      canonicalPath: 'vault://tenants/tenant-a/environments/environment-dev/data-adapters/adapter-a/headers/apiKey',
      secret: {
        id: 'secret-1',
        status: 'active',
        currentVersion: 1,
        versions: [],
      },
    });
    const productionWorkload: SecretWorkloadIdentity = {
      id: 'adapter-workload',
      tenantIds: ['tenant-a'],
      environmentIds: ['environment-production'],
      workspaceIds: ['workspace-a'],
      adapterIds: ['adapter-a'],
    };
    const scope: SecretScope & { reference: string } = {
      tenantId: 'tenant-a',
      environmentId: 'environment-dev',
      workspaceId: 'workspace-a',
      adapterId: 'adapter-a',
      reference: 'vault://tenants/tenant-a/environments/environment-dev/data-adapters/adapter-a/headers/apiKey',
    };

    await expect(service.resolve(productionWorkload, scope)).rejects.toThrow(
      'Workload is not authorized for this secret scope.',
    );

    expect(roles.effectiveRoleIds).not.toHaveBeenCalled();
    expect(transaction.secretAccessLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorType: 'workload',
          action: 'security.secret.use',
          outcome: 'deny',
          reason: 'workload_scope_mismatch',
        }),
      }),
    );
  });
});

const actor: SecretActor = {
  actorId: 'user-a',
  tenantId: 'tenant-a',
  environmentId: 'environment-dev',
  workspaceId: 'workspace-a',
  adapterId: 'adapter-a',
};

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
