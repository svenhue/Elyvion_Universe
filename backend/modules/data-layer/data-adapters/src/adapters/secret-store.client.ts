import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import axios from 'axios';

export interface AdapterSecretInput {
  name: string;
  type: 'password' | 'api_key' | 'token' | 'private_key' | 'oauth_client_secret';
  configKey: string;
  value: string;
}

export interface AdapterSecretBinding {
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  reference: string;
  configKey: string;
}

export interface AdapterSecretScope {
  tenantId: string;
  environmentId: string;
  workspaceId: string;
  adapterId: string;
}

interface SecretEnvelope<T> {
  data: T;
}

@Injectable()
export class SecretStoreClient {
  private readonly securityUrl = process.env.SECURITY_URL ?? 'http://localhost:3022';

  async createReferences(
    scope: AdapterSecretScope,
    secrets: AdapterSecretInput[],
    authorization: string | undefined,
    requestId?: string,
  ): Promise<AdapterSecretBinding[]> {
    if (!secrets.length) return [];
    if (!authorization?.startsWith('Bearer ')) {
      throw new ServiceUnavailableException('A user bearer token is required to store adapter secrets.');
    }
    this.assertSecureTransport();
    try {
      const response = await axios.post<SecretEnvelope<AdapterSecretBinding[]>>(
        `${this.securityUrl}/v1/secrets`,
        { ...scope, secrets },
        {
          headers: {
            authorization,
            'x-tenant-id': scope.tenantId,
            ...(requestId ? { 'x-correlation-id': requestId } : {}),
          },
          timeout: 10_000,
        },
      );
      if (!Array.isArray(response.data.data) || response.data.data.length !== secrets.length) {
        throw new BadGatewayException('Secret store returned invalid secret metadata.');
      }
      return response.data.data;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (axios.isAxiosError(error) && error.response?.status) {
        throw new ServiceUnavailableException(`Secret store rejected the secret operation (HTTP ${error.response.status}).`);
      }
      throw new ServiceUnavailableException('Secret store is unavailable.');
    }
  }

  async resolveReference(
    reference: string,
    scope: AdapterSecretScope,
    requestId?: string,
  ): Promise<string> {
    const runtimeEnvironmentId = process.env.DATA_ADAPTER_ENVIRONMENT_ID?.trim();
    if (!runtimeEnvironmentId || runtimeEnvironmentId !== scope.environmentId) {
      throw new ServiceUnavailableException('Adapter runtime is not authorized for this environment.');
    }
    this.assertSecureTransport();
    const identity = await this.readWorkloadIdentity();
    try {
      const response = await axios.post<SecretEnvelope<{ value: string }>>(
        `${this.securityUrl}/v1/internal/secrets/resolve`,
        { ...scope, reference },
        {
          headers: {
            'x-workload-id': identity.workloadId,
            'x-workload-token': identity.token,
            ...(requestId ? { 'x-correlation-id': requestId } : {}),
          },
          timeout: 5000,
        },
      );
      if (typeof response.data.data?.value !== 'string' || !response.data.data.value) {
        throw new BadGatewayException('Secret store returned an invalid secret value.');
      }
      return response.data.data.value;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (axios.isAxiosError(error) && error.response?.status) {
        throw new ServiceUnavailableException(`Secret resolution was denied (HTTP ${error.response.status}).`);
      }
      throw new ServiceUnavailableException('Secret store is unavailable.');
    }
  }

  async deleteReferences(
    scope: AdapterSecretScope,
    bindings: AdapterSecretBinding[],
    authorization: string | undefined,
    requestId?: string,
  ): Promise<void> {
    if (!authorization?.startsWith('Bearer ')) return;
    this.assertSecureTransport();
    for (const binding of bindings) {
      try {
        await axios.delete(
          `${this.securityUrl}/v1/secrets/${encodeURIComponent(binding.id)}`,
          {
            params: scope,
            headers: {
              authorization,
              'x-tenant-id': scope.tenantId,
              ...(requestId ? { 'x-correlation-id': requestId } : {}),
            },
            timeout: 5000,
          },
        );
      } catch {
        throw new ServiceUnavailableException('Adapter secret could not be deleted.');
      }
    }
  }

  private async readWorkloadIdentity(): Promise<{ workloadId: string; token: string }> {
    const path = process.env.SECRET_STORE_WORKLOAD_CREDENTIAL_FILE;
    if (!path) throw new ServiceUnavailableException('Adapter workload identity is not configured.');
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      const record = parsed as Record<string, unknown>;
      if (typeof record['workloadId'] !== 'string' || typeof record['token'] !== 'string') throw new Error();
      return { workloadId: record['workloadId'], token: record['token'] };
    } catch {
      throw new ServiceUnavailableException('Adapter workload identity file is unavailable or invalid.');
    }
  }

  private assertSecureTransport(): void {
    let url: URL;
    try {
      url = new URL(this.securityUrl);
    } catch {
      throw new ServiceUnavailableException('Secret store URL is invalid.');
    }
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) {
      throw new ServiceUnavailableException('Secret store traffic requires HTTPS.');
    }
  }
}
