export type AdapterType = 'http' | 'file' | 'jdbc' | 'sap';
export const ADAPTER_TYPES: AdapterType[] = ['http', 'file', 'jdbc', 'sap'];

export interface DataAdapterConfig {
  _id: string;
  tenantId: string;
  environmentId: string;
  workspaceId: string;
  name: string;
  type: AdapterType;
  description?: string;
  connectionConfig: Record<string, unknown>;
  secretReferences: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    version: number;
    reference: string;
    configKey: string;
  }>;
  schedule?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataAdapterInput {
  name: string;
  type: AdapterType;
  connectionConfig: Record<string, unknown>;
  secrets?: Array<{
    name: string;
    type: 'password' | 'api_key' | 'token' | 'private_key' | 'oauth_client_secret';
    configKey: string;
    value: string;
  }>;
  schedule?: string;
}

export interface DataAdapterScope {
  tenantId: string;
  workspaceId: string;
  environmentId: string;
}

export type DataAdapterRunStatus = 'running' | 'succeeded' | 'failed';

export interface DataAdapterRun {
  _id: string;
  adapterId: string;
  status: DataAdapterRunStatus;
  startedAt: string;
  finishedAt?: string;
  recordsProcessed?: number;
  error?: string;
}
