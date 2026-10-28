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
  /** Canvas position in the frontend builder's graph view — purely presentational, never read by the processor. */
  position?: { x: number; y: number };
}

export interface SetVariableStep extends WorkflowStepBase {
  type: 'set-variable';
  variableName: string;
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

export interface ActionStep extends WorkflowStepBase {
  type: 'action';
  /** A key from `actions-engine`'s `GET /actions` — the same registry a human uses via the Actions panel and an AI agent uses via MCP. */
  actionKey: string;
  input?: unknown;
}

export interface RuleStep extends WorkflowStepBase {
  type: 'rule';
  /** A key from `rules-engine`'s `GET /rules`. */
  ruleKey: string;
  input?: unknown;
}

/**
 * An agent, embedded directly as a workflow node — the pattern n8n's own
 * "AI Agent" node uses: give it a task, it runs (`agent-engine` designs
 * and runs a team against it), and its final answer becomes this step's
 * output, usable by whatever runs next. Polls `agent-engine` rather than
 * firing-and-forgetting, since the step after this one typically needs
 * the agent's actual answer.
 */
export interface AgentStep extends WorkflowStepBase {
  type: 'agent';
  /** Literal task text, or a `$context...` path — resolved against the run's context, same as `action`/`http-request`. */
  task: unknown;
  /** How long to poll before failing this step (default 120s) — an agent run has no fixed upper bound otherwise. */
  timeoutSeconds?: number;
}

/**
 * BPMN-lite: a start/end event is a pure marker (no runtime behavior of
 * its own) that makes the flow's entry/exit points visible in the
 * builder, rather than relying solely on `startStepId` and "a step with
 * no `next`" to communicate that — a start event just passes straight
 * through to `next`; an end event has no `next` at all, so the run
 * finishes exactly like it already does at any other terminal step.
 */
export interface StartEventStep extends WorkflowStepBase {
  type: 'start-event';
}

export interface EndEventStep extends WorkflowStepBase {
  type: 'end-event';
}

export interface ExclusiveGatewayCase {
  /** Compared against the rule's output, stringified — the first matching case's `next` wins. */
  value: string;
  next: string[];
}

/**
 * BPMN's XOR gateway: runs a `rules-engine` rule and branches on its
 * output — "in einem XOR-Gateway kann eine Geschäftsregel verwendet
 * werden, die einen passenden Output-Wert hat, der wird dann geprüft."
 * `next` (inherited from `WorkflowStepBase`) is the fallback when no
 * case matches the rule's output.
 */
export interface ExclusiveGatewayStep extends WorkflowStepBase {
  type: 'exclusive-gateway';
  ruleKey: string;
  input?: unknown;
  cases: ExclusiveGatewayCase[];
}

export type WorkflowStep =
  | SetVariableStep
  | HttpRequestStep
  | CallServiceStep
  | ConditionStep
  | DelayStep
  | ParallelStep
  | ActionStep
  | RuleStep
  | AgentStep
  | StartEventStep
  | EndEventStep
  | ExclusiveGatewayStep;

export interface WorkflowDefinitionBody {
  startStepId: string;
  steps: WorkflowStep[];
}
