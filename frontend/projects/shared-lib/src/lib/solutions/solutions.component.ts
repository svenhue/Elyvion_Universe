import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeploymentEngineApiService } from '../deployment-engine/deployment-engine-api.service';
import { Deployment, DeploymentTarget } from '../deployment-engine/deployment-engine-schema';
import { SolutionsApiService } from './solutions-api.service';
import { SOLUTION_MEMBER_TYPES, Solution, SolutionMemberType } from './solutions-schema';

/**
 * Manage Solutions — named bundles of apps/workflows/agents/knowledge
 * graphs/entities an enterprise can deploy as one unit, instead of
 * tracking 50 applications as one flat, ungrouped list. See
 * solutions/README.md for why this is called "Solution" and not
 * "Ressource" (the user's own word, already taken by `security`).
 */
@Component({
  selector: 'elv-solutions',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './solutions.component.html',
})
export class SolutionsComponent implements OnInit {
  private readonly api = inject(SolutionsApiService);
  private readonly deploymentApi = inject(DeploymentEngineApiService);

  readonly memberTypes = SOLUTION_MEMBER_TYPES;
  readonly solutions = signal<Solution[]>([]);
  readonly selectedKey = signal<string | null>(null);
  readonly loadError = signal('');

  readonly targets = signal<DeploymentTarget[]>([]);
  readonly deployments = signal<Deployment[]>([]);
  readonly deploymentsLoading = signal(false);

  readonly newKey = signal('');
  readonly newName = signal('');
  readonly newDescription = signal('');
  readonly creating = signal(false);

  readonly newMemberType = signal<SolutionMemberType>('application');
  readonly newMemberKey = signal('');
  readonly newMemberLabel = signal('');

  readonly selectedSolution = computed(() => this.solutions().find((s) => s.key === this.selectedKey()) ?? null);

  ngOnInit(): void {
    this.reload();
    this.deploymentApi.listTargets().subscribe({ next: (targets) => this.targets.set(targets) });
  }

  private reload(): void {
    this.api.list().subscribe({
      next: (solutions) => this.solutions.set(solutions),
      error: () => this.loadError.set('Lösungen konnten nicht geladen werden.'),
    });
  }

  targetName(targetId: string): string {
    return this.targets().find((t) => t._id === targetId)?.name ?? targetId;
  }

  select(key: string): void {
    this.selectedKey.set(key);
    this.deployments.set([]);
    this.deploymentsLoading.set(true);
    this.deploymentApi.list(key).subscribe({
      next: (deployments) => {
        this.deployments.set(deployments);
        this.deploymentsLoading.set(false);
      },
      error: () => this.deploymentsLoading.set(false),
    });
  }

  async createSolution(): Promise<void> {
    const key = this.newKey().trim();
    const name = this.newName().trim();
    if (!key || !name || this.creating()) return;
    this.creating.set(true);
    try {
      const created = await firstValueFrom(this.api.create(key, name, this.newDescription().trim() || undefined));
      this.newKey.set('');
      this.newName.set('');
      this.newDescription.set('');
      this.solutions.update((solutions) => [...solutions, created]);
      this.select(created.key);
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Lösung konnte nicht angelegt werden.');
    } finally {
      this.creating.set(false);
    }
  }

  async removeSolution(key: string): Promise<void> {
    await firstValueFrom(this.api.remove(key));
    this.solutions.update((solutions) => solutions.filter((s) => s.key !== key));
    if (this.selectedKey() === key) this.selectedKey.set(null);
  }

  async addMember(): Promise<void> {
    const key = this.selectedKey();
    const resourceKey = this.newMemberKey().trim();
    if (!key || !resourceKey) return;
    const updated = await firstValueFrom(
      this.api.addMember(key, {
        resourceType: this.newMemberType(),
        resourceKey,
        label: this.newMemberLabel().trim() || undefined,
      }),
    );
    this.solutions.update((solutions) => solutions.map((s) => (s.key === key ? updated : s)));
    this.newMemberKey.set('');
    this.newMemberLabel.set('');
  }

  async removeMember(resourceType: string, resourceKey: string): Promise<void> {
    const key = this.selectedKey();
    if (!key) return;
    const updated = await firstValueFrom(this.api.removeMember(key, resourceType, resourceKey));
    this.solutions.update((solutions) => solutions.map((s) => (s.key === key ? updated : s)));
  }
}
