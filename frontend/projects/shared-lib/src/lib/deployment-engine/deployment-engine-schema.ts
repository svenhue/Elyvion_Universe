export type TargetType = 'local-docker' | 'aws' | 'gcp' | 'azure';
export const TARGET_TYPES: TargetType[] = ['local-docker', 'aws', 'gcp', 'azure'];

export interface DeploymentTarget {
  _id: string;
  name: string;
  type: TargetType;
  config: Record<string, unknown>;
  createdAt: string;
}

export type DeploymentStatus = 'pending' | 'building' | 'running' | 'failed' | 'stopped';

export interface Deployment {
  _id: string;
  name: string;
  targetId: string;
  /** The Solution (see `solutions` module) this deployment deploys, if any. */
  solutionKey?: string;
  status: DeploymentStatus;
  handle?: string;
  port?: number;
  url?: string;
  error?: string;
  createdAt: string;
  liveStatus?: 'running' | 'stopped' | 'unknown';
}
