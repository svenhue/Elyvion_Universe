import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkloadIdentityService } from './workload-identity.service';

describe('WorkloadIdentityService', () => {
  let directory = '';
  const previousCredentialFile = process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE;
  const service = new WorkloadIdentityService();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'elyvion-workload-test-'));
    process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE = join(directory, 'workloads.json');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    if (previousCredentialFile === undefined) {
      delete process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE;
    } else {
      process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE = previousCredentialFile;
    }
  });

  it('authenticates a workload restricted to one environment', async () => {
    await writeCredentials(['environment-dev']);

    await expect(service.authenticate('adapter-dev', 'opaque-token')).resolves.toMatchObject({
      id: 'adapter-dev',
      tenantIds: ['tenant-a'],
      environmentIds: ['environment-dev'],
      workspaceIds: ['workspace-a'],
      adapterIds: ['adapter-a'],
    });
  });

  it('rejects credentials that span multiple environments', async () => {
    await writeCredentials(['environment-dev', 'environment-production']);

    await expect(service.authenticate('adapter-dev', 'opaque-token')).rejects.toThrow(
      'Invalid workload credentials.',
    );
  });

  async function writeCredentials(environmentIds: string[]): Promise<void> {
    await writeFile(
      process.env.SECRET_STORE_WORKLOAD_CREDENTIALS_FILE!,
      JSON.stringify({
        'adapter-dev': {
          token: 'opaque-token',
          tenantIds: ['tenant-a'],
          environmentIds,
          workspaceIds: ['workspace-a'],
          adapterIds: ['adapter-a'],
        },
      }),
      { mode: 0o600 },
    );
  }
});
