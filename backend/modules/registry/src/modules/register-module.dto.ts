import { z } from 'zod';

export const registerModuleSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ts', 'py']),
  baseUrl: z.string().url(),
  routePrefix: z.string().min(1).startsWith('/'),
  healthCheckUrl: z.string().url(),
  version: z.string().min(1),
});

export type RegisterModuleDto = z.infer<typeof registerModuleSchema>;
