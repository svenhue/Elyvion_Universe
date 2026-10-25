import { z } from 'zod';

export const recordVersionSchema = z.object({
  resourceType: z.string().min(1),
  resourceKey: z.string().min(1),
  snapshot: z.record(z.string(), z.unknown()),
  changedBy: z.string().optional(),
});
export type RecordVersionDto = z.infer<typeof recordVersionSchema>;
