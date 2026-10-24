import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createActor, fromPromise, setup } from 'xstate';
import { ActionsApiService } from '../actions/actions-api.service';
import { FrontendActionsService } from '../actions/frontend-actions.service';
import { AppStateService } from '../application-runner/state/app-state.service';
import { readPath, resolveTemplate } from './resolve-template';
import { WorkflowApiService } from './workflow-api.service';
import { WorkflowDefinition, WorkflowRunState, WorkflowStep } from './workflow-schema';

/** Thrown out of `runGraph` on an unrecovered step failure, carrying the run state accumulated so far. */
class WorkflowRunError extends Error {
  constructor(message: string, readonly state: WorkflowRunState) {
    super(message);
  }
}

/**
 * Runs `target: "frontend"` workflow definitions in the browser.
 *
 * The run's lifecycle (idle → running → succeeded/failed) is a genuine
 * XState machine — that part of a workflow run *is* naturally a state
 * machine, and XState is the established library for it. The step GRAPH
 * itself isn't modeled as XState states: an arbitrary DAG with fan-out/
 * fan-in doesn't map onto XState's parallel *regions*, which are fixed at
 * design time, not generated per workflow — so graph traversal (sequential
 * steps, `condition` branches, `parallel` fan-out via `Promise.all`) is
 * plain async code invoked as the machine's single `running` actor. Each
 * step reuses the same `$context.…`-template resolution as the backend
 * workflow-engine module, so workflow authors learn one syntax for both.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowRunnerService {
  private readonly appState = inject(AppStateService);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly frontendActions = inject(FrontendActionsService);
  private readonly actionsApi = inject(ActionsApiService);

  /** Starts `definition` and resolves once the whole run finishes — success or failure both resolve, never reject, so callers don't need a catch just to read the final state. */
  run(definition: WorkflowDefinition, initialContext: Record<string, unknown> = {}): Promise<WorkflowRunState> {
    return new Promise((resolve) => {
      const machine = setup({
        actors: {
          runGraph: fromPromise<WorkflowRunState, void>(() => this.runGraph(definition, initialContext)),
        },
      }).createMachine({
        id: `workflow-${definition.key}`,
        initial: 'running',
        states: {
          running: {
            invoke: {
              src: 'runGraph',
              onDone: { target: 'succeeded', actions: ({ event }) => resolve(event.output) },
              onError: {
                target: 'failed',
                actions: ({ event }) => {
                  const error = event.error;
                  resolve(error instanceof WorkflowRunError ? error.state : failedState(String(error)));
                },
              },
            },
          },
          succeeded: { type: 'final' },
          failed: { type: 'final' },
        },
      });
      createActor(machine).start();
    });
  }

  /** Plain-async DAG traversal — see the class doc comment for why this isn't XState states. */
  private async runGraph(definition: WorkflowDefinition, initialContext: Record<string, unknown>): Promise<WorkflowRunState> {
    const steps = new Map(definition.steps.map((step) => [step.id, step]));
    const state: WorkflowRunState = { status: 'running', context: { ...initialContext }, steps: [] };

    const runFrom = async (stepId: string): Promise<void> => {
      const step = steps.get(stepId);
      if (!step) {
        throw new WorkflowRunError(`Workflow "${definition.key}": no step "${stepId}".`, state);
      }

      const startedAt = Date.now();
      try {
        const output = await this.executeStep(step, state.context);
        state.context = { ...state.context, [step.id]: output };
        state.steps.push({ stepId: step.id, status: 'succeeded', output, startedAt, finishedAt: Date.now() });

        const nextIds = this.nextStepIds(step, state.context);
        await Promise.all(nextIds.map((id) => runFrom(id)));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.steps.push({ stepId: step.id, status: 'failed', error: message, startedAt, finishedAt: Date.now() });

        if (step.onError?.length) {
          await Promise.all(step.onError.map((id) => runFrom(id)));
          return;
        }
        state.status = 'failed';
        state.error = message;
        throw new WorkflowRunError(message, state);
      }
    };

    await runFrom(definition.startStepId);
    state.status = 'succeeded';
    return state;
  }

  private nextStepIds(step: WorkflowStep, context: Record<string, unknown>): string[] {
    if (step.type === 'condition') {
      const actual = readPath(context, step.path.replace(/^\$context\./, ''));
      return (actual === step.equals ? step.whenTrue : step.next) ?? [];
    }
    if (step.type === 'parallel') {
      return step.branches;
    }
    return step.next ?? [];
  }

  private async executeStep(step: WorkflowStep, context: Record<string, unknown>): Promise<unknown> {
    switch (step.type) {
      case 'set-variable': {
        const value = resolveTemplate(step.value, context);
        const existing = this.appState.getVariable(step.variableName);
        this.appState.setVariable(step.variableName, existing?.type ?? 'string', value);
        return value;
      }

      case 'delay':
        await new Promise((resolve) => setTimeout(resolve, step.milliseconds));
        return undefined;

      case 'condition':
      case 'parallel':
        return undefined;

      case 'run-script': {
        // Trusted, builder-authored code only — see `EventAction.script`'s doc comment.
        return new Function('appState', 'context', step.script)(this.appState, context);
      }

      case 'call-backend-workflow': {
        const body = (step.context ? resolveTemplate(step.context, context) : {}) as Record<string, unknown>;
        return firstValueFrom(this.workflowApi.run(step.workflowKey, body));
      }

      case 'http-request': {
        const url = resolveTemplate(step.url, context) as string;
        const body = step.body ? resolveTemplate(step.body, context) : undefined;
        const response = await fetch(url, {
          method: step.method,
          headers: { 'content-type': 'application/json', ...(step.headers ?? {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, body: await safeJson(response) };
      }

      case 'call-service':
        // Backend-only (see `WorkflowStepType`'s doc comment) — the builder
        // shouldn't let a frontend-target workflow contain one of these.
        throw new Error(`"call-service" step "${step.id}" can't run client-side — it's a backend-target-only step kind.`);

      case 'action': {
        const input = (step.input ? resolveTemplate(step.input, context) : {}) as Record<string, unknown>;
        // A frontend-target action's handler only exists in this tab, so
        // check there first; a backend-target action key falls through to
        // the same HTTP call the backend processor itself makes.
        if (this.frontendActions.has(step.actionKey)) {
          return this.frontendActions.execute(step.actionKey, input);
        }
        return firstValueFrom(this.actionsApi.execute(step.actionKey, input));
      }
    }
  }
}

function failedState(error: string): WorkflowRunState {
  return { status: 'failed', context: {}, steps: [], error };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
