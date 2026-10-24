import { z } from 'zod';

export const createLogSchema = z.object({
  source: z.string().min(1),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  message: z.string().min(1),
  actionKey: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLogDto = z.infer<typeof createLogSchema>;

export const listLogsQuerySchema = z.object({
  source: z.string().optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  actionKey: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional().default(100),
});
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
