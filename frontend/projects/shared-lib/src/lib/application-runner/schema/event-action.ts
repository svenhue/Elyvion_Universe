/**
 * What an event handler action does when it runs. `call-service` is
 * intentionally selectable but a no-op for now — there's no service
 * registry yet to target, so wiring it up is future work; everything
 * else here actually executes (see DynamicRendererComponent.runAction()).
 */
export type EventActionType =
  | 'set-variable'
  | 'trigger-event'
  | 'control-component'
  | 'run-script'
  | 'call-service'
  | 'run-workflow';

export interface EventAction {
  type: EventActionType;
  /** set-variable */
  variableName?: string;
  variableValue?: unknown;
  /** trigger-event */
  targetNodeId?: string;
  targetEvent?: string;
  /**
   * control-component — calls `targetComponentId`'s instance method
   * `functionName(...functionArgs)`. Any public method the target
   * component class defines is callable this way; there's no separate
   * "exposed functions" declaration to keep in sync.
   */
  targetComponentId?: string;
  functionName?: string;
  functionArgs?: unknown[];
  /**
   * run-script — executed as the body of `new Function(script)`. This is
   * arbitrary code execution: only ever wire this up for the builder's
   * own trusted authors, never for untrusted end-user input.
   */
  script?: string;
  /** call-service — not executed yet, see the type doc above. */
  serviceName?: string;
  /**
   * run-workflow — key of a `WorkflowDefinition`. Runs on `WorkflowRunnerService`
   * (`target: "frontend"`) or is forwarded to the backend workflow-engine
   * module (`target: "backend"`), looked up by `workflowKey` at run time.
   */
  workflowKey?: string;
}

/** A node's `events` map: DOM-ish event name → actions run in order when it fires. */
export type EventHandlers = Record<string, EventAction[]>;
