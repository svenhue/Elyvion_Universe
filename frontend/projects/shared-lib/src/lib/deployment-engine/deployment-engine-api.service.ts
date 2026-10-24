import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { Deployment, DeploymentTarget, TargetType } from './deployment-engine-schema';

/** Talks to the `deployment-engine` backend module. */
@Injectable({ providedIn: 'root' })
export class DeploymentEngineApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'deployment-engine';

  listTargets() {
    return this.api.get<DeploymentTarget[]>(DeploymentEngineApiService.MODULE, '/deployment-targets').pipe(map((r) => r.data));
  }

  createTarget(name: string, type: TargetType, config: Record<string, unknown> = {}) {
    return this.api
      .post<DeploymentTarget>(DeploymentEngineApiService.MODULE, '/deployment-targets', { name, type, config })
      .pipe(map((r) => r.data));
  }

  list() {
    return this.api.get<Deployment[]>(DeploymentEngineApiService.MODULE, '/deployments').pipe(map((r) => r.data));
  }

  deploy(name: string, targetId: string) {
    return this.api
      .post<Deployment>(DeploymentEngineApiService.MODULE, '/deployments', { name, targetId })
      .pipe(map((r) => r.data));
  }

  status(id: string) {
    return this.api.get<Deployment>(DeploymentEngineApiService.MODULE, `/deployments/${id}/status`).pipe(map((r) => r.data));
  }

  stop(id: string) {
    return this.api.post<Deployment>(DeploymentEngineApiService.MODULE, `/deployments/${id}/stop`, {}).pipe(map((r) => r.data));
  }
}
