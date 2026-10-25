/**
 * A workflow step graph — authored in `WorkflowBuilderComponent` for
 * *either* a `target: "frontend"` workflow (interpreted in-browser by
 * `WorkflowRunnerService`, an XState machine built from this graph at run
 * time) or a `target: "backend"` one (stored the same way but executed by
 * the backend `workflow-engine` module's own processor). One step-type
 * union covers both, so the builder has a single, consistent list to
 * offer — see `stepTypesForTarget()` in the builder for which of these
 * each target actually supports:
 * - `set-variable`, `http-request`, `condition`, `delay`, `parallel`,
 *   `action`: shared, run by whichever side executes the workflow —
 *   `action` runs one `actions-engine` action by key, resolved locally
 *   first via `FrontendActionsService` (for a frontend-target action)
 *   and over HTTP otherwise, same registry a human uses via the Actions
 *   panel and an AI agent uses via MCP.
 * - `run-script`, `call-backend-workflow`: frontend-only — `run-script`
 *   needs a trusted in-browser `Function()`, `call-backend-workflow` is
 *   how a frontend workflow hands off to a backend one.
 * - `call-service`: backend-only — an inter-module call via the
 *   Registry; not reachable the same way from a browser.
 * - `rule`, `agent`: backend-only, same as `call-service` — `rule` runs
 *   a `rules-engine` business rule by key; `agent` is the n8n-style "AI
 *   Agent node" pattern, starting an `agent-engine` run and polling it
 *   to completion so the next step gets the agent's actual answer. Both
 *   could become shared later (a browser can call the Gateway too) but
 *   only the backend processor implements them right now.
 * - `start-event`, `end-event`, `exclusive-gateway`: backend-only,
 *   BPMN-lite. The two events are pure markers (no runtime behavior);
 *   the gateway runs a rule and branches on its output — BPMN's XOR
 *   gateway.
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
  | 'parallel'
  | 'action'
  | 'rule'
  | 'agent'
  | 'start-event'
  | 'end-event'
  | 'exclusive-gateway';

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

export interface WorkflowActionStep extends WorkflowStepBase {
  type: 'action';
  /** A key from `actions-engine`'s `GET /actions`. */
  actionKey: string;
  /** Literal object, or a `"$context...."` path, resolved against this run's context before the call. */
  input?: unknown;
}

export interface WorkflowRuleStep extends WorkflowStepBase {
  type: 'rule';
  /** A key from `rules-engine`'s `GET /rules`. */
  ruleKey: string;
  input?: unknown;
}

/**
 * An agent, embedded directly as a workflow node — the n8n "AI Agent
 * node" pattern: give it a task, `agent-engine` designs and runs a team
 * against it, and the final answer becomes this step's output.
 */
export interface WorkflowAgentStep extends WorkflowStepBase {
  type: 'agent';
  /** Literal task text, or a `"$context...."` path, resolved against this run's context before the call. */
  task: unknown;
  /** How long to wait before failing this step (default 120s). */
  timeoutSeconds?: number;
}

export interface WorkflowStartEventStep extends WorkflowStepBase {
  type: 'start-event';
}

export interface WorkflowEndEventStep extends WorkflowStepBase {
  type: 'end-event';
}

export interface WorkflowExclusiveGatewayCase {
  /** Compared against the rule's output, stringified — the first matching case's `next` wins. */
  value: string;
  next: string[];
}

/** BPMN's XOR gateway — runs a rule and branches on its output. `next` (inherited) is the fallback when no case matches. */
export interface WorkflowExclusiveGatewayStep extends WorkflowStepBase {
  type: 'exclusive-gateway';
  ruleKey: string;
  input?: unknown;
  cases: WorkflowExclusiveGatewayCase[];
}

export type WorkflowStep =
  | WorkflowSetVariableStep
  | WorkflowRunScriptStep
  | WorkflowHttpRequestStep
  | WorkflowCallBackendStep
  | WorkflowCallServiceStep
  | WorkflowConditionStep
  | WorkflowDelayStep
  | WorkflowParallelStep
  | WorkflowActionStep
  | WorkflowRuleStep
  | WorkflowAgentStep
  | WorkflowStartEventStep
  | WorkflowEndEventStep
  | WorkflowExclusiveGatewayStep;

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
