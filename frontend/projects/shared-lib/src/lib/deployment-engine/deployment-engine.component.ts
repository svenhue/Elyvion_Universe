import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeploymentEngineApiService } from './deployment-engine-api.service';
import { Deployment, DeploymentTarget, TARGET_TYPES, TargetType } from './deployment-engine-schema';

/**
 * Manage deployment targets (today: `local-docker`, see
 * deployment-engine/README.md for the cloud-provider roadmap) and
 * deployments — trigger a build+run, see its live status (an actual
 * `docker inspect`, not a cached value), stop it.
 */
@Component({
  selector: 'elv-deployment-engine',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './deployment-engine.component.html',
})
export class DeploymentEngineComponent implements OnInit {
  private readonly api = inject(DeploymentEngineApiService);

  readonly targetTypes = TARGET_TYPES;
  readonly targets = signal<DeploymentTarget[]>([]);
  readonly deployments = signal<Deployment[]>([]);
  readonly loadError = signal('');

  readonly newTargetName = signal('');
  readonly newTargetType = signal<TargetType>('local-docker');
  readonly creatingTarget = signal(false);

  readonly newDeploymentName = signal('');
  readonly newDeploymentTargetId = signal('');
  readonly deploying = signal(false);
  readonly deployError = signal('');

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.listTargets().subscribe({
      next: (targets) => {
        this.targets.set(targets);
        if (!this.newDeploymentTargetId() && targets.length) {
          this.newDeploymentTargetId.set(targets[0]._id);
        }
      },
      error: () => this.loadError.set('Deployment-Ziele konnten nicht geladen werden.'),
    });
    this.api.list().subscribe({ next: (deployments) => this.deployments.set(deployments) });
  }

  targetName(id: string): string {
    return this.targets().find((t) => t._id === id)?.name ?? id;
  }

  async createTarget(): Promise<void> {
    const name = this.newTargetName().trim();
    if (!name || this.creatingTarget()) return;
    this.creatingTarget.set(true);
    try {
      const created = await firstValueFrom(this.api.createTarget(name, this.newTargetType()));
      this.newTargetName.set('');
      this.targets.update((targets) => [...targets, created]);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Ziel konnte nicht angelegt werden.');
    } finally {
      this.creatingTarget.set(false);
    }
  }

  async deploy(): Promise<void> {
    const name = this.newDeploymentName().trim();
    const targetId = this.newDeploymentTargetId();
    if (!name || !targetId || this.deploying()) return;
    this.deploying.set(true);
    this.deployError.set('');
    try {
      const deployment = await firstValueFrom(this.api.deploy(name, targetId));
      this.newDeploymentName.set('');
      this.deployments.update((deployments) => [deployment, ...deployments]);
    } catch (error) {
      this.deployError.set(error instanceof Error ? error.message : 'Deployment fehlgeschlagen.');
    } finally {
      this.deploying.set(false);
    }
  }

  async refreshStatus(id: string): Promise<void> {
    const updated = await firstValueFrom(this.api.status(id));
    this.deployments.update((deployments) => deployments.map((d) => (d._id === id ? updated : d)));
  }

  async stop(id: string): Promise<void> {
    const updated = await firstValueFrom(this.api.stop(id));
    this.deployments.update((deployments) => deployments.map((d) => (d._id === id ? updated : d)));
  }
}
