import { z } from 'zod';
import { TARGET_TYPES } from '../schemas/deployment-target.schema';

export const createTargetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(TARGET_TYPES),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});
export type CreateTargetDto = z.infer<typeof createTargetSchema>;

export const createDeploymentSchema = z.object({
  name: z.string().min(1),
  targetId: z.string().min(1),
});
export type CreateDeploymentDto = z.infer<typeof createDeploymentSchema>;
