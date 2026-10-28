import { z } from 'zod';
import { RESOURCE_TYPES } from '../schemas/solution.schema';

export const createSolutionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sourceRepositoryKey: z.string().optional(),
});
export type CreateSolutionDto = z.infer<typeof createSolutionSchema>;

export const memberSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  resourceKey: z.string().min(1),
  label: z.string().optional(),
});
export const addMemberSchema = memberSchema;
export type AddMemberDto = z.infer<typeof addMemberSchema>;

/** Replaces a Solution's entire member list in one call — "Repository deployen" (update mode) snapshots the repository's current members onto the Solution this way, instead of diffing add/remove. */
export const setMembersSchema = z.object({
  members: z.array(memberSchema),
});
export type SetMembersDto = z.infer<typeof setMembersSchema>;
