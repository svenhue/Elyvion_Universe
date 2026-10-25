import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { catchError, of } from 'rxjs';
import { AgentApiService } from '../agent-engine/agent-api.service';
import { DataAdaptersApiService } from '../data-adapters/data-adapters-api.service';
import { DataEngineApiService } from '../data-engine/data-engine-api.service';
import { RulesEngineApiService } from '../rules-engine/rules-engine-api.service';
import { SolutionsApiService } from '../solutions/solutions-api.service';
import { Solution } from '../solutions/solutions-schema';
import { WorkflowApiService } from '../workflow/workflow-api.service';
import {
  REPOSITORY_ITEM_TYPE_LABELS,
  REPOSITORY_ITEM_TYPES,
  REPOSITORY_TO_SOLUTION_MEMBER_TYPE,
  RepositoryItem,
  RepositoryItemType,
} from './repository-schema';

/**
 * "Ein Kernrepository, wo wir alle diese Objekte erstellen" — one browsable
 * catalog over every object kind a Solution can bundle (Agents, Workflows,
 * Entities) plus the two kinds that exist but aren't bundleable (Data-Adapters,
 * Regeln), each linking back to its owning module for actual creation/editing.
 * Also the fastest path to "put this object into a Solution" without leaving
 * the catalog to go find it again on five different pages.
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

  readonly itemTypes = REPOSITORY_ITEM_TYPES;
  readonly typeLabels = REPOSITORY_ITEM_TYPE_LABELS;

  readonly items = signal<RepositoryItem[]>([]);
  readonly loading = signal(true);
  readonly searchQuery = signal('');
  readonly typeFilter = signal<RepositoryItemType | 'all'>('all');

  readonly solutions = signal<Solution[]>([]);
  readonly addTargetKey = signal<Record<string, string>>({});
  readonly addStatus = signal<Record<string, string>>({});

  readonly filteredItems = computed(() => {
    const needle = this.searchQuery().trim().toLowerCase();
    const type = this.typeFilter();
    return this.items().filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (!needle) return true;
      return item.name.toLowerCase().includes(needle) || item.key.toLowerCase().includes(needle);
    });
  });

  ngOnInit(): void {
    this.solutionsApi.list().subscribe({ next: (solutions) => this.solutions.set(solutions) });
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    Promise.all([
      firstValueFrom(this.agentApi.listPrompts().pipe(catchError(() => of([])))),
      firstValueFrom(this.workflowApi.list().pipe(catchError(() => of([])))),
      firstValueFrom(this.dataEngineApi.listEntities().pipe(catchError(() => of([])))),
      firstValueFrom(this.dataAdaptersApi.list().pipe(catchError(() => of([])))),
      firstValueFrom(this.rulesApi.list().pipe(catchError(() => of([])))),
    ]).then(([prompts, workflows, entities, adapters, rules]) => {
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

  solutionMemberType(item: RepositoryItem): string | undefined {
    return REPOSITORY_TO_SOLUTION_MEMBER_TYPE[item.type];
  }

  itemId(item: RepositoryItem): string {
    return `${item.type}:${item.key}`;
  }

  async addToSolution(item: RepositoryItem): Promise<void> {
    const memberType = this.solutionMemberType(item);
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
}
