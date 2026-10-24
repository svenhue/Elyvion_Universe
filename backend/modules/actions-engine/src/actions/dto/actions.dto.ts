import { z } from 'zod';

export const registerFrontendActionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
});
export type RegisterFrontendActionDto = z.infer<typeof registerFrontendActionSchema>;
