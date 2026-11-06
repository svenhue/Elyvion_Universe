import { z } from 'zod';
import { ADAPTER_TYPES } from '../schemas/data-adapter.schema';

const secretSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['password', 'api_key', 'token', 'private_key', 'oauth_client_secret']),
  configKey: z.string().min(1),
  value: z.string().min(1).max(64_000),
});

export const createAdapterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ADAPTER_TYPES),
  description: z.string().optional(),
  connectionConfig: z.record(z.string(), z.unknown()),
  secrets: z.array(secretSchema).max(20).optional().default([]),
  schedule: z.string().min(1).optional(),
  enabled: z.boolean().optional().default(true),
});
export type CreateAdapterDto = z.infer<typeof createAdapterSchema>;

export const updateAdapterSchema = createAdapterSchema.partial();
export type UpdateAdapterDto = z.infer<typeof updateAdapterSchema>;

export const scheduleAdapterSchema = z.object({
  /** A cron expression, or `null` to switch the adapter back to manual-trigger-only. */
  schedule: z.string().min(1).nullable(),
});
export type ScheduleAdapterDto = z.infer<typeof scheduleAdapterSchema>;

export const deployAdapterSchema = z.object({
  sourceEnvironmentId: z.string().min(1),
  sourceWorkspaceId: z.string().min(1),
  sourceAdapterId: z.string().min(1),
});
export type DeployAdapterDto = z.infer<typeof deployAdapterSchema>;
