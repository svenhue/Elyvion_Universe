export type HealthStatus = 'up' | 'down';
export type TargetSource = 'registry_module' | 'deployment' | 'manual';

export interface HealthCheckResult {
  id: string;
  status: HealthStatus;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface HealthTargetStatus {
  id: string;
  name: string;
  url: string;
  source: TargetSource;
  latest: HealthCheckResult | null;
}
