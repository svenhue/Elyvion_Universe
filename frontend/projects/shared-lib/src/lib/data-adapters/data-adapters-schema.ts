export type AdapterType = 'http' | 'file' | 'jdbc' | 'sap';
export const ADAPTER_TYPES: AdapterType[] = ['http', 'file', 'jdbc', 'sap'];

export interface DataAdapterConfig {
  _id: string;
  name: string;
  type: AdapterType;
  description?: string;
  connectionConfig: Record<string, unknown>;
  schedule?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataAdapterInput {
  name: string;
  type: AdapterType;
  connectionConfig: Record<string, unknown>;
  schedule?: string;
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
