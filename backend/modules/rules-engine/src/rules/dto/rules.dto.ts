import { z } from 'zod';
import { ruleBlockSchema } from '../rule-block';

export const createRuleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional().default({}),
  blocks: z.array(ruleBlockSchema).optional().default([]),
  outputFormat: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateRuleDto = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = createRuleSchema.partial().omit({ key: true });
export type UpdateRuleDto = z.infer<typeof updateRuleSchema>;

export const executeRuleSchema = z.object({
  input: z.unknown(),
});
export type ExecuteRuleDto = z.infer<typeof executeRuleSchema>;
