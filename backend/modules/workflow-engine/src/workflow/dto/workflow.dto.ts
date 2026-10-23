import { z } from 'zod';

const stepBase = {
  id: z.string().min(1),
  next: z.array(z.string()).optional(),
  onError: z.array(z.string()).optional(),
};

const workflowStepSchema = z.discriminatedUnion('type', [
  z.object({ ...stepBase, type: z.literal('set-variable'), key: z.string().min(1), value: z.unknown() }),
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
