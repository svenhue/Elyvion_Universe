import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AgentApiService } from '../agent-engine/agent-api.service';
import { DataAdaptersApiService } from '../data-adapters/data-adapters-api.service';
import { DataEngineApiService } from '../data-engine/data-engine-api.service';
import { EntityDefinition } from '../data-engine/data-engine-schema';
import { Rule } from '../rules-engine/rules-engine-schema';
import { RulesEngineApiService } from '../rules-engine/rules-engine-api.service';
import { Solution } from '../solutions/solutions-schema';
import { SolutionsApiService } from '../solutions/solutions-api.service';
import { WorkflowApiService, WorkflowDefinitionRecord } from '../workflow/workflow-api.service';
import { RepositoriesApiService } from './repositories-api.service';
import {
  COPYABLE_ITEM_TYPES,
  REPOSITORY_ITEM_TYPE_LABELS,
  REPOSITORY_ITEM_TYPES,
  REPOSITORY_TO_RESOURCE_TYPE,
  RESOURCE_TYPE_LABELS,
  RepositoryItem,
  RepositoryItemType,
  RepositoryMemberRef,
  RepositoryRecord,
} from './repository-schema';

const KERN = 'kern';

/**
 * "Ein Repository kann aus Workflow-Definition, Entitätsdefinition,
 * Anwendungsdefinition, Aktionsdefinition oder aus Logik bestehen. Das ist
 * das Kernrepository, wo erstmal per Default alles abgespeichert wird...
 * Benutzer können aber auch neue Repositories erstellen."
 *
 * Master-detail over two very different things sharing one sidebar:
 * - **Kernrepository** (`KERN`, pinned first, never deletable) — not a
 *   document anywhere; it's the live union of everything every owning
 *   module already has, exactly what this page showed before this
 *   rewrite. Lets you browse everything and copy any item into a real
 *   Repository, or add it straight to a Solution.
 * - **User-created Repositories** — real `repository`-module documents,
 *   a curated member list you build up (by copying from the
 *   Kernrepository, which physically duplicates the underlying object
 *   and records `copiedFrom` for later "update the copy too?" prompts)
 *   and can deploy as a Solution snapshot.
 */
@Component({
  selector: 'elv-repository',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './repository.component.html',
})
export class RepositoryComponent implements OnInit {
  private readonly agentApi = inject(AgentApiService);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly dataEngineApi = inject(DataEngineApiService);
  private readonly dataAdaptersApi = inject(DataAdaptersApiService);
  private readonly rulesApi = inject(RulesEngineApiService);
  private readonly solutionsApi = inject(SolutionsApiService);
  private readonly repositoriesApi = inject(RepositoriesApiService);

  readonly KERN = KERN;
  readonly itemTypes = REPOSITORY_ITEM_TYPES;
  readonly typeLabels = REPOSITORY_ITEM_TYPE_LABELS;
  readonly resourceTypeLabels = RESOURCE_TYPE_LABELS;

  // --- Kernrepository (computed, browse-everything) ---
  readonly items = signal<RepositoryItem[]>([]);
  readonly loading = signal(true);
  readonly searchQuery = signal('');
  readonly typeFilter = signal<RepositoryItemType | 'all'>('all');

  private rawWorkflows = signal<WorkflowDefinitionRecord[]>([]);
  private rawEntities = signal<EntityDefinition[]>([]);
  private rawRules = signal<Rule[]>([]);

  readonly filteredItems = computed(() => {
    const needle = this.searchQuery().trim().toLowerCase();
    const type = this.typeFilter();
    return this.items().filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!needle) return true;
      return item.name.toLowerCase().includes(needle) || item.key.toLowerCase().includes(needle);
    });
  });

  readonly solutions = signal<Solution[]>([]);
  readonly addTargetKey = signal<Record<string, string>>({});
  readonly addStatus = signal<Record<string, string>>({});

  // --- copy-to-repository (Kernrepository rows -> a real Repository) ---
  readonly copyTargetRepoKey = signal<Record<string, string>>({});
  readonly copyNewKey = signal<Record<string, string>>({});
  readonly copyStatus = signal<Record<string, string>>({});

  // --- sidebar: Kernrepository vs. real Repositories ---
  readonly repositories = signal<RepositoryRecord[]>([]);
  readonly selectedScope = signal<string>(KERN);
  readonly isKernSelected = computed(() => this.selectedScope() === KERN);
  readonly selectedRepository = computed(() => this.repositories().find((r) => r.key === this.selectedScope()) ?? null);

  readonly newRepoKey = signal('');
  readonly newRepoName = signal('');
  readonly newRepoDescription = signal('');
  readonly creatingRepo = signal(false);

  // --- Repository -> Solution deploy ---
  readonly linkedSolutions = signal<Solution[]>([]);
  readonly newSolutionKey = signal('');
  readonly newSolutionName = signal('');
  readonly deployStatus = signal('');

  ngOnInit(): void {
    this.solutionsApi.list().subscribe({ next: (solutions) => this.solutions.set(solutions) });
    this.reloadRepositories();
    this.reloadKern();
  }

  private reloadRepositories(): void {
    this.repositoriesApi.list().subscribe({ next: (repositories) => this.repositories.set(repositories) });
  }

  private reloadKern(): void {
    this.loading.set(true);
    Promise.all([
      firstValueFrom(this.agentApi.listPrompts().pipe(catchError(() => of([])))),
      firstValueFrom(this.workflowApi.list().pipe(catchError(() => of([])))),
      firstValueFrom(this.dataEngineApi.listEntities().pipe(catchError(() => of([])))),
      firstValueFrom(this.dataAdaptersApi.list().pipe(catchError(() => of([])))),
      firstValueFrom(this.rulesApi.list().pipe(catchError(() => of([])))),
    ]).then(([prompts, workflows, entities, adapters, rules]) => {
      this.rawWorkflows.set(workflows);
      this.rawEntities.set(entities);
      this.rawRules.set(rules);
      const items: RepositoryItem[] = [
        ...prompts.map((p) => ({ type: 'agent' as const, key: p.key, name: p.name, detail: p.description, link: '/agents' })),
        ...workflows.map((w) => ({
          type: 'workflow' as const,
          key: w.key,
          name: w.name,
          detail: `v${w.version} · ${w.target}`,
          link: '/workflows',
        })),
        ...entities.map((e) => ({
          type: 'entity' as const,
          key: e.name,
          name: e.name,
          detail: `${e.fields.length} Feld(er)`,
          link: '/data',
        })),
        ...adapters.map((a) => ({
          type: 'data-adapter' as const,
          key: a._id,
          name: a.name,
          detail: a.type,
          link: '/data-adapters',
        })),
        ...rules.map((r) => ({ type: 'rule' as const, key: r.key, name: r.name, detail: r.description, link: '/rules' })),
      ];
      this.items.set(items);
      this.loading.set(false);
    });
  }

  resourceType(item: RepositoryItem) {
    return REPOSITORY_TO_RESOURCE_TYPE[item.type];
  }

  isCopyable(item: RepositoryItem): boolean {
    return COPYABLE_ITEM_TYPES.includes(item.type);
  }

  itemId(item: RepositoryItem): string {
    return `${item.type}:${item.key}`;
  }

  async addToSolution(item: RepositoryItem): Promise<void> {
    const memberType = this.resourceType(item);
    const solutionKey = this.addTargetKey()[this.itemId(item)];
    if (!memberType || !solutionKey) return;
    try {
      await firstValueFrom(this.solutionsApi.addMember(solutionKey, { resourceType: memberType as never, resourceKey: item.key, label: item.name }));
      this.addStatus.update((status) => ({ ...status, [this.itemId(item)]: 'Hinzugefügt.' }));
    } catch (error) {
      this.addStatus.update((status) => ({
        ...status,
        [this.itemId(item)]: error instanceof Error ? error.message : 'Fehlgeschlagen.',
      }));
    }
  }

  setAddTarget(item: RepositoryItem, solutionKey: string): void {
    this.addTargetKey.update((targets) => ({ ...targets, [this.itemId(item)]: solutionKey }));
  }

  setCopyTarget(item: RepositoryItem, repoKey: string): void {
    this.copyTargetRepoKey.update((targets) => ({ ...targets, [this.itemId(item)]: repoKey }));
  }

  setCopyNewKey(item: RepositoryItem, value: string): void {
    this.copyNewKey.update((keys) => ({ ...keys, [this.itemId(item)]: value }));
  }

  /** "Vom Kernrepository eine Workflow-Definition auf ein neues Repository kopieren" — physically duplicates the object in its owning module (new key), then records the copy as a Repository member with `copiedFrom`. */
  async copyToRepository(item: RepositoryItem): Promise<void> {
    const id = this.itemId(item);
    const targetRepoKey = this.copyTargetRepoKey()[id];
    const resourceType = this.resourceType(item);
    const newKey = this.copyNewKey()[id]?.trim() || `${item.key}-copy`;
    if (!targetRepoKey || !resourceType || !this.isCopyable(item)) return;

    try {
      switch (item.type) {
        case 'workflow': {
          const record = this.rawWorkflows().find((w) => w.key === item.key);
          if (!record) throw new Error('Workflow nicht gefunden.');
          await firstValueFrom(
            this.workflowApi.save({
              key: newKey,
              name: `${record.name} (Kopie)`,
              target: record.target,
              startStepId: record.definition.startStepId,
              steps: record.definition.steps,
            }),
          );
          break;
        }
        case 'entity': {
          const entity = this.rawEntities().find((e) => e.name === item.key);
          if (!entity) throw new Error('Entität nicht gefunden.');
          await firstValueFrom(this.dataEngineApi.createEntity({ name: newKey, fields: entity.fields }));
          break;
        }
        case 'rule': {
          const rule = this.rawRules().find((r) => r.key === item.key);
          if (!rule) throw new Error('Regel nicht gefunden.');
          await firstValueFrom(this.rulesApi.create(newKey, `${rule.name} (Kopie)`, rule.description));
          await firstValueFrom(this.rulesApi.updateBlocks(newKey, rule.blocks));
          break;
        }
        default:
          throw new Error('Kopieren für diesen Typ nicht unterstützt.');
      }

      await firstValueFrom(
        this.repositoriesApi.addMember(targetRepoKey, {
          resourceType,
          resourceKey: newKey,
          label: item.name,
          copiedFrom: { resourceType, resourceKey: item.key },
        }),
      );
      this.copyStatus.update((status) => ({ ...status, [id]: 'Kopiert.' }));
      this.reloadRepositories();
      this.reloadKern();
    } catch (error) {
      this.copyStatus.update((status) => ({ ...status, [id]: error instanceof Error ? error.message : 'Fehlgeschlagen.' }));
    }
  }

  // --- sidebar / Repository CRUD ---

  selectScope(key: string): void {
    this.selectedScope.set(key);
    this.deployStatus.set('');
    this.newSolutionKey.set('');
    this.newSolutionName.set('');
    if (key === KERN) {
      this.linkedSolutions.set([]);
      return;
    }
    this.solutionsApi.list(key).subscribe({ next: (solutions) => this.linkedSolutions.set(solutions) });
  }

  async createRepository(): Promise<void> {
    const key = this.newRepoKey().trim();
    const name = this.newRepoName().trim();
    if (!key || !name || this.creatingRepo()) return;
    this.creatingRepo.set(true);
    try {
      const created = await firstValueFrom(this.repositoriesApi.create(key, name, this.newRepoDescription().trim() || undefined));
      this.newRepoKey.set('');
      this.newRepoName.set('');
      this.newRepoDescription.set('');
      this.repositories.update((repositories) => [...repositories, created]);
      this.selectScope(created.key);
    } finally {
      this.creatingRepo.set(false);
    }
  }

  async removeRepository(key: string): Promise<void> {
    await firstValueFrom(this.repositoriesApi.remove(key));
    this.repositories.update((repositories) => repositories.filter((r) => r.key !== key));
    if (this.selectedScope() === key) this.selectScope(KERN);
  }

  async removeRepoMember(resourceType: string, resourceKey: string): Promise<void> {
    const repo = this.selectedRepository();
    if (!repo) return;
    const updated = await firstValueFrom(this.repositoriesApi.removeMember(repo.key, resourceType, resourceKey));
    this.repositories.update((repositories) => repositories.map((r) => (r.key === repo.key ? updated : r)));
  }

  private toSolutionMembers(members: RepositoryMemberRef[]) {
    return members.map((m) => ({ resourceType: m.resourceType, resourceKey: m.resourceKey, label: m.label }));
  }

  /** "Ich kann ein Repository nehmen und sagen, ich möchte das Repository jetzt deployen, und dann entsteht eine Lösung" — overwrites the already-linked Solution's members with the repository's current state. */
  async updateLinkedSolution(): Promise<void> {
    const repo = this.selectedRepository();
    const solution = this.linkedSolutions()[0];
    if (!repo || !solution) return;
    try {
      const updated = await firstValueFrom(this.solutionsApi.setMembers(solution.key, this.toSolutionMembers(repo.members)));
      this.linkedSolutions.set([updated]);
      this.deployStatus.set(`"${updated.name}" aktualisiert.`);
    } catch (error) {
      this.deployStatus.set(error instanceof Error ? error.message : 'Fehlgeschlagen.');
    }
  }

  async createSolutionFromRepository(): Promise<void> {
    const repo = this.selectedRepository();
    const key = this.newSolutionKey().trim();
    const name = this.newSolutionName().trim();
    if (!repo || !key || !name) return;
    try {
      await firstValueFrom(this.solutionsApi.create(key, name, undefined, repo.key));
      const updated = await firstValueFrom(this.solutionsApi.setMembers(key, this.toSolutionMembers(repo.members)));
      this.linkedSolutions.update((solutions) => [...solutions, updated]);
      this.newSolutionKey.set('');
      this.newSolutionName.set('');
      this.deployStatus.set(`"${updated.name}" angelegt.`);
    } catch (error) {
      this.deployStatus.set(error instanceof Error ? error.message : 'Fehlgeschlagen.');
    }
  }
}
