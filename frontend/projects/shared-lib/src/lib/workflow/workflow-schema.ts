/**
 * A workflow step graph — authored in `WorkflowBuilderComponent` for
 * *either* a `target: "frontend"` workflow (interpreted in-browser by
 * `WorkflowRunnerService`, an XState machine built from this graph at run
 * time) or a `target: "backend"` one (stored the same way but executed by
 * the backend `workflow-engine` module's own processor). One step-type
 * union covers both, so the builder has a single, consistent list to
 * offer — see `stepTypesForTarget()` in the builder for which of these
 * each target actually supports:
 * - `set-variable`, `http-request`, `condition`, `delay`, `parallel`:
 *   shared, run by whichever side executes the workflow.
 * - `run-script`, `call-backend-workflow`: frontend-only — `run-script`
 *   needs a trusted in-browser `Function()`, `call-backend-workflow` is
 *   how a frontend workflow hands off to a backend one.
 * - `call-service`: backend-only — an inter-module call via the
 *   Registry; not reachable the same way from a browser.
 *
 * `control-component` / `trigger-event` (the event-handler system's other
 * action kinds, see `EventAction`) aren't available as workflow steps yet
 * — a workflow runs independently of any one render session, and reaching
 * a specific rendered component from there needs a registry this first
 * pass doesn't build. Next step, not done here.
 */
export type WorkflowStepType =
  | 'set-variable'
  | 'run-script'
  | 'http-request'
  | 'call-backend-workflow'
  | 'call-service'
  | 'condition'
  | 'delay'
  | 'parallel';

export interface WorkflowStepBase {
  id: string;
  type: WorkflowStepType;
  /** Step ids to run next on success. Several ids = fan-out (run concurrently). */
  next?: string[];
  /** Step ids to run instead, on failure — the compensation/error branch. */
  onError?: string[];
  /** Canvas position in `WorkflowBuilderComponent`'s graph view — purely presentational, never read by either execution engine. */
  position?: { x: number; y: number };
}

export interface WorkflowSetVariableStep extends WorkflowStepBase {
  type: 'set-variable';
  variableName: string;
  /** Literal value, or `"$context.someStepId"` to read an earlier step's output from this run's own context. */
  value: unknown;
}

export interface WorkflowRunScriptStep extends WorkflowStepBase {
  type: 'run-script';
  /** Trusted, builder-authored code only — see `EventAction.script`'s doc comment. Receives `(appState, context)`. */
  script: string;
}

export interface WorkflowCallBackendStep extends WorkflowStepBase {
  type: 'call-backend-workflow';
  /** Key of a workflow registered with the backend workflow-engine module. */
  workflowKey: string;
  /** Literal object, or a `"$context...."` path, resolved against this run's context before the call. */
  context?: unknown;
}

export interface WorkflowHttpRequestStep extends WorkflowStepBase {
  type: 'http-request';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Absolute URL, or a `"$context...."` path, resolved against this run's context before the call. */
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface WorkflowCallServiceStep extends WorkflowStepBase {
  type: 'call-service';
  /** Backend-only — a module name as registered with the Registry (see `@elyvion/shared`'s `registerModule`). */
  serviceName: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export interface WorkflowConditionStep extends WorkflowStepBase {
  type: 'condition';
  /** `"$context.someStepId"` (or a dotted path into it) read from this run's context. */
  path: string;
  equals: unknown;
  /** Step ids to run when the comparison is true — `next` runs when it's false. */
  whenTrue?: string[];
}

export interface WorkflowDelayStep extends WorkflowStepBase {
  type: 'delay';
  milliseconds: number;
}

export interface WorkflowParallelStep extends WorkflowStepBase {
  type: 'parallel';
  /** All run concurrently; the step completes once every branch has. */
  branches: string[];
}

export type WorkflowStep =
  | WorkflowSetVariableStep
  | WorkflowRunScriptStep
  | WorkflowHttpRequestStep
  | WorkflowCallBackendStep
  | WorkflowCallServiceStep
  | WorkflowConditionStep
  | WorkflowDelayStep
  | WorkflowParallelStep;

export interface WorkflowDefinition {
  key: string;
  name: string;
  target: 'frontend' | 'backend';
  startStepId: string;
  steps: WorkflowStep[];
}

export type WorkflowRunStatus = 'running' | 'succeeded' | 'failed';

export interface WorkflowStepRunRecord {
  stepId: string;
  status: 'succeeded' | 'failed';
  output?: unknown;
  error?: string;
  startedAt: number;
  finishedAt: number;
}

/** A frontend run's own isolated state — never touches the global `AppStateService` unless a step opts into it via `set-variable`. */
export interface WorkflowRunState {
  status: WorkflowRunStatus;
  context: Record<string, unknown>;
  steps: WorkflowStepRunRecord[];
  error?: string;
}
