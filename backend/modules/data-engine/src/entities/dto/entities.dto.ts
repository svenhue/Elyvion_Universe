import { z } from 'zod';

export const fieldDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  required: z.boolean().optional().default(false),
});
export type FieldDefDto = z.infer<typeof fieldDefSchema>;

export const createEntitySchema = z.object({
  name: z.string().min(1),
  fields: z.array(fieldDefSchema).min(1),
});
export type CreateEntityDto = z.infer<typeof createEntitySchema>;
