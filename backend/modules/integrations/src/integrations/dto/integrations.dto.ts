import { z } from 'zod';

export const createIntegrationSchema = z.object({
  key: z.string().min(1),
  provider: z.string().min(1),
  name: z.string().min(1),
  connectionConfig: z.record(z.string(), z.unknown()),
});
export type CreateIntegrationDto = z.infer<typeof createIntegrationSchema>;

export const executeIntegrationActionSchema = z.object({
  input: z.record(z.string(), z.unknown()).optional().default({}),
});
export type ExecuteIntegrationActionDto = z.infer<typeof executeIntegrationActionSchema>;
