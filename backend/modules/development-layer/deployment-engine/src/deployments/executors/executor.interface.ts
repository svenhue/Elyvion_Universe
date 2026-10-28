import { TargetType } from '../schemas/deployment-target.schema';

export interface DeploymentHandle {
  /** Opaque to everything outside the executor that produced it (a Docker container id, a cloud provider's deployment id, ...). */
  handle: string;
  port?: number;
  url?: string;
}

/**
 * One deployment target, behind a single shape — "deploy this application"
 * means the same thing (validate the target's config once, `deploy()` /
 * `stop()` / `getStatus()`) whether the target is a local Docker daemon
 * today or a cloud provider once that executor exists. Adding a cloud
 * provider means adding one class here and one line in
 * `executor-registry.ts`; nothing else in the module changes.
 */
export interface DeploymentExecutor {
  readonly type: TargetType;

  validateConfig(config: Record<string, unknown>): void;

  deploy(deploymentName: string, config: Record<string, unknown>): Promise<DeploymentHandle>;

  stop(handle: string, config: Record<string, unknown>): Promise<void>;

  getStatus(handle: string, config: Record<string, unknown>): Promise<'running' | 'stopped' | 'unknown'>;
}
