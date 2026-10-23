import { z } from 'zod';

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MODULE_NAME: z.string().min(1),
  MODULE_BASE_URL: z.string().url(),
  REGISTRY_URL: z.string().url(),
  AUTH_ISSUER_URL: z.string().url(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  config: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
