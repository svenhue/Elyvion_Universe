import { z } from 'zod';
import { ADAPTER_TYPES } from '../schemas/data-adapter.schema';

export const createAdapterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ADAPTER_TYPES),
  description: z.string().optional(),
  connectionConfig: z.record(z.string(), z.unknown()),
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
