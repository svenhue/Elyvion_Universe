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
  /** The Solution (bundle of apps/workflows/agents, see the `solutions` module) this deployment deploys, if any. */
  solutionKey: z.string().min(1).optional(),
});
export type CreateDeploymentDto = z.infer<typeof createDeploymentSchema>;
