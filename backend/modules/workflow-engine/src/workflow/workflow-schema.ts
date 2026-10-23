/**
 * A workflow step graph (DAG, not necessarily linear): each step names
 * the step(s) that run after it on success (`next`) and, separately, on
 * failure (`onError`) — a saga-style compensation branch. Mirrors the
 * frontend's `workflow-schema.ts` field-for-field; kept as a separate
 * copy rather than a shared package, same as this project's other
 * frontend/backend schema pairs (e.g. `DynamicAppSchema`).
 */
export type WorkflowStepType =
  | 'set-variable'
  | 'http-request'
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
}

export interface SetVariableStep extends WorkflowStepBase {
  type: 'set-variable';
  key: string;
  /** Literal value, or `"$steps.someStepId.output.field"` to read from an earlier step's output. */
  value: unknown;
}

export interface HttpRequestStep extends WorkflowStepBase {
  type: 'http-request';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Absolute URL, or a `$context.key` / literal path — resolved against the run's context. */
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface CallServiceStep extends WorkflowStepBase {
  type: 'call-service';
  /** A module name as registered with the Registry (see `@elyvion/shared`'s `registerModule`). */
  serviceName: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export interface ConditionStep extends WorkflowStepBase {
  type: 'condition';
  /** `"$context.key"` read from the run's context, compared with `equals`. */
  path: string;
  equals: unknown;
  /** Step ids to run when the comparison is true — `next` runs when it's false. */
  whenTrue?: string[];
}

export interface DelayStep extends WorkflowStepBase {
  type: 'delay';
  milliseconds: number;
}

export interface ParallelStep extends WorkflowStepBase {
  type: 'parallel';
  /** All run concurrently; the step completes once every branch has. */
  branches: string[];
}

export type WorkflowStep =
  | SetVariableStep
  | HttpRequestStep
  | CallServiceStep
  | ConditionStep
  | DelayStep
  | ParallelStep;

export interface WorkflowDefinitionBody {
  startStepId: string;
  steps: WorkflowStep[];
}
