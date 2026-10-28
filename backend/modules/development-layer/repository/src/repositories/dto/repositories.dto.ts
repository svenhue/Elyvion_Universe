import { z } from 'zod';
import { RESOURCE_TYPES } from '../schemas/repository.schema';

export const createRepositorySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateRepositoryDto = z.infer<typeof createRepositorySchema>;

const originSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  resourceKey: z.string().min(1),
});

export const memberSchema = z.object({
  resourceType: z.enum(RESOURCE_TYPES),
  resourceKey: z.string().min(1),
  label: z.string().optional(),
  copiedFrom: originSchema.optional(),
});
export const addMemberSchema = memberSchema;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
