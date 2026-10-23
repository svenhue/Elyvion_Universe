import { Injectable } from '@angular/core';
import { WorkflowDefinition } from './workflow-schema';

/**
 * In-memory lookup of `target: "frontend"` workflow definitions by key,
 * so a `run-workflow` event action can find the graph to run. There's no
 * authoring UI or persistence for these yet (unlike `AppStateService`'s
 * variables) — register them from app bootstrap code for now; a pro-code
 * "Workflows" panel to build and save them is the natural next step.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowDefinitionRegistryService {
  private readonly definitions = new Map<string, WorkflowDefinition>();

  register(definition: WorkflowDefinition): void {
    this.definitions.set(definition.key, definition);
  }

  get(key: string): WorkflowDefinition | undefined {
    return this.definitions.get(key);
  }
}
