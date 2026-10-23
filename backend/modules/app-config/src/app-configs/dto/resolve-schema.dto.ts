import { z } from 'zod';

export const resolveSchemaRequestSchema = z.object({
  applicationId: z.string().min(1),
  userId: z.string().min(1),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type ResolveSchemaRequest = z.infer<typeof resolveSchemaRequestSchema>;

export const upsertAppConfigSchema = z.object({
  applicationId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1).default('1.0.0'),
  rootComponentId: z.string().min(1),
  components: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      attributes: z.record(z.string(), z.unknown()).optional(),
      children: z.array(z.string()).optional(),
    }),
  ),
});

export type UpsertAppConfigDto = z.infer<typeof upsertAppConfigSchema>;
