import { z } from 'zod';

const stepBase = {
  id: z.string().min(1),
  next: z.array(z.string()).optional(),
  onError: z.array(z.string()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
};

const workflowStepSchema = z.discriminatedUnion('type', [
  z.object({ ...stepBase, type: z.literal('set-variable'), variableName: z.string().min(1), value: z.unknown() }),
  z.object({
    ...stepBase,
    type: z.literal('http-request'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    url: z.string().min(1),
    headers: z.record(z.string()).optional(),
    body: z.unknown().optional(),
  }),
  z.object({
    ...stepBase,
    type: z.literal('call-service'),
    serviceName: z.string().min(1),
    path: z.string().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    body: z.unknown().optional(),
  }),
  z.object({
    ...stepBase,
    type: z.literal('condition'),
    path: z.string().min(1),
    equals: z.unknown(),
    whenTrue: z.array(z.string()).optional(),
  }),
  z.object({ ...stepBase, type: z.literal('delay'), milliseconds: z.number().int().nonnegative() }),
  z.object({ ...stepBase, type: z.literal('parallel'), branches: z.array(z.string()).min(1) }),
  // Runs one `actions-engine` action by key. A backend-target workflow's
  // processor always calls it over HTTP; a frontend-target workflow's
  // runner resolves it locally first (FrontendActionsService) and only
  // falls back to HTTP for a backend-target action key.
  z.object({ ...stepBase, type: z.literal('action'), actionKey: z.string().min(1), input: z.unknown().optional() }),
  // Runs a `rules-engine` business rule by key.
  z.object({ ...stepBase, type: z.literal('rule'), ruleKey: z.string().min(1), input: z.unknown().optional() }),
  // The n8n-style "AI Agent node": starts an `agent-engine` run and polls
  // it to completion — see `WorkflowProcessor.runAgentStep`.
  z.object({
    ...stepBase,
    type: z.literal('agent'),
    task: z.unknown(),
    timeoutSeconds: z.number().int().positive().optional(),
  }),
  // BPMN-lite start/end events — pure markers, no payload.
  z.object({ ...stepBase, type: z.literal('start-event') }),
  z.object({ ...stepBase, type: z.literal('end-event') }),
  // BPMN's XOR gateway: runs a rule, branches on its output.
  z.object({
    ...stepBase,
    type: z.literal('exclusive-gateway'),
    ruleKey: z.string().min(1),
    input: z.unknown().optional(),
    cases: z.array(z.object({ value: z.string().min(1), next: z.array(z.string()).min(1) })).min(1),
  }),
  // Frontend-only step kinds (see the frontend's `workflow-schema.ts`) —
  // the backend only ever *stores* these, for a `target: "frontend"`
  // workflow; its own processor never executes them (see its step
  // switch, which has no case for either).
  z.object({ ...stepBase, type: z.literal('run-script'), script: z.string().min(1) }),
  z.object({
    ...stepBase,
    type: z.literal('call-backend-workflow'),
    workflowKey: z.string().min(1),
    context: z.unknown().optional(),
  }),
]);

export const createWorkflowSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  target: z.enum(['frontend', 'backend']),
  startStepId: z.string().min(1),
  steps: z.array(workflowStepSchema).min(1),
});
export type CreateWorkflowDto = z.infer<typeof createWorkflowSchema>;

export const startRunSchema = z.object({
  context: z.record(z.unknown()).optional(),
});
export type StartRunDto = z.infer<typeof startRunSchema>;
