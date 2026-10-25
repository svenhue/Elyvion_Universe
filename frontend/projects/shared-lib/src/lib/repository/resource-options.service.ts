import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AgentApiService } from '../agent-engine/agent-api.service';
import { AppConfigApiService } from '../application-runner/service/app-config-api.service';
import { DataEngineApiService } from '../data-engine/data-engine-api.service';
import { RulesEngineApiService } from '../rules-engine/rules-engine-api.service';
import { SolutionsApiService } from '../solutions/solutions-api.service';
import { WorkflowApiService } from '../workflow/workflow-api.service';
import { RepositoriesApiService } from './repositories-api.service';
import { ResourceType } from './resource-type';

export interface ResourceOption {
  key: string;
  label: string;
}

/**
 * "Ich will überall einen Dropdown haben, wo ich die zur Verfügung
 * stehenden Ressourcen aus dem Kernrepository dann auswählen kann" —
 * one place that knows, for a given `ResourceType`, which concrete
 * objects actually exist right now, so a "Mitglied hinzufügen" form
 * never needs a free-typed key. `knowledge_graph` has no catalog this
 * hub can browse yet (see `repository.component.ts`'s own `data-adapter`
 * caveat), so it falls back to an empty list — callers show a plain text
 * input when that happens.
 */
@Injectable({ providedIn: 'root' })
export class ResourceOptionsService {
  private readonly agentApi = inject(AgentApiService);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly dataEngineApi = inject(DataEngineApiService);
  private readonly rulesApi = inject(RulesEngineApiService);
  private readonly repositoriesApi = inject(RepositoriesApiService);
  private readonly solutionsApi = inject(SolutionsApiService);
  private readonly appConfigApi = inject(AppConfigApiService);

  optionsFor(type: ResourceType): Observable<ResourceOption[]> {
    switch (type) {
      case 'agent':
        return this.agentApi.listPrompts().pipe(map((prompts) => prompts.map((p) => ({ key: p.key, label: p.name }))));
      case 'workflow':
        return this.workflowApi.list().pipe(map((workflows) => workflows.map((w) => ({ key: w.key, label: w.name }))));
      case 'entity':
        return this.dataEngineApi.listEntities().pipe(map((entities) => entities.map((e) => ({ key: e.name, label: e.name }))));
      case 'rule':
        return this.rulesApi.list().pipe(map((rules) => rules.map((r) => ({ key: r.key, label: r.name }))));
      case 'repository':
        return this.repositoriesApi.list().pipe(map((repos) => repos.map((r) => ({ key: r.key, label: r.name }))));
      case 'solution':
        return this.solutionsApi.list().pipe(map((solutions) => solutions.map((s) => ({ key: s.key, label: s.name }))));
      case 'application':
        return this.appConfigApi.list().pipe(map((apps) => apps.map((a) => ({ key: a.applicationId, label: a.name }))));
      default:
        return of([]);
    }
  }
}
