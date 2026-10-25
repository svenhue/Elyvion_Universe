import { z } from 'zod';
import { SOLUTION_MEMBER_TYPES } from '../schemas/solution.schema';

export const createSolutionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateSolutionDto = z.infer<typeof createSolutionSchema>;

export const addMemberSchema = z.object({
  resourceType: z.enum(SOLUTION_MEMBER_TYPES),
  resourceKey: z.string().min(1),
  label: z.string().optional(),
});
export type AddMemberDto = z.infer<typeof addMemberSchema>;
