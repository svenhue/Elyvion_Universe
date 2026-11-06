import { SchedulerRegistry } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { ConnectorRegistry } from './connectors/connector-registry';
import { SecretStoreClient } from './secret-store.client';
import { AdaptersService } from './adapters.service';
import { DataAdapterConfig, DataAdapterConfigDocument } from './schemas/data-adapter.schema';
import { DataAdapterDeployment, DataAdapterDeploymentDocument } from './schemas/data-adapter-deployment.schema';
import { DataAdapterRun, DataAdapterRunDocument } from './schemas/data-adapter-run.schema';

describe('AdaptersService deployment', () => {
  it('stores only destination-environment secret references in the deployment manifest', async () => {
    const sourceReference = {
      id: 'source-secret',
      name: 'API token',
      type: 'token',
      status: 'active',
      version: 1,
      reference: 'vault://tenants/tenant-a/environments/environment-dev/data-adapters/source-adapter/headers.apiKey',
      configKey: 'headers.apiKey',
    };
    const targetReference = {
      ...sourceReference,
      id: 'target-secret',
      reference: 'vault://tenants/tenant-a/environments/environment-stage/data-adapters/target-adapter/headers.apiKey',
    };
    const source = {
      name: 'External source',
      type: 'http',
      connectionConfig: { url: 'https://service.example.test' },
      secretReferences: [sourceReference],
      enabled: false,
    };
    const target = {
      name: 'Target stub',
      type: 'http',
      connectionConfig: { url: 'https://old.example.test' },
      secretReferences: [targetReference],
      enabled: false,
    };
    const deploymentRecord = {
      _id: 'deployment-1',
      status: 'pending',
      manifest: { secretReferences: [targetReference] },
      toObject() {
        return this;
      },
    };
    const adapters = {
      findOne: jest.fn((query: Record<string, unknown>) => ({
        lean: jest.fn().mockResolvedValue(query['_id'] === 'source-adapter' ? source : target),
      })),
      findOneAndUpdate: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({ ...target, ...source }),
      })),
    };
    const deployments = {
      create: jest.fn().mockResolvedValue(deploymentRecord),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    const connectors = { get: jest.fn().mockReturnValue({ validateConfig: jest.fn() }) };
    const scheduler = { doesExist: jest.fn().mockReturnValue(false) };
    const service = new AdaptersService(
      adapters as unknown as Model<DataAdapterConfigDocument>,
      deployments as unknown as Model<DataAdapterDeploymentDocument>,
      {} as Model<DataAdapterRunDocument>,
      connectors as unknown as ConnectorRegistry,
      scheduler as unknown as SchedulerRegistry,
      {} as SecretStoreClient,
    );
    const targetScope = {
      tenantId: 'tenant-a',
      environmentId: 'environment-stage',
      workspaceId: 'workspace-a',
      adapterId: 'target-adapter',
    };
    const sourceScope = {
      tenantId: 'tenant-a',
      environmentId: 'environment-dev',
      workspaceId: 'workspace-a',
      adapterId: 'source-adapter',
    };

    const result = await service.deploy('target-adapter', targetScope, sourceScope, 'source-adapter');

    const manifest = deployments.create.mock.calls[0][0].manifest;
    expect(manifest.secretReferences).toEqual([targetReference]);
    expect(JSON.stringify(manifest)).not.toContain(sourceReference.reference);
    expect(result).not.toHaveProperty('manifest');
  });
});
