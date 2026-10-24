import { z } from 'zod';

export const registerTargetSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  source: z.enum(['registry_module', 'deployment', 'manual']).optional().default('manual'),
  checkIntervalSeconds: z.number().int().positive().optional().default(30),
});
export type RegisterTargetDto = z.infer<typeof registerTargetSchema>;
