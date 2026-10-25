import { z } from 'zod';
import { FIELD_TYPES } from '../schemas/entity-definition.schema';

export const fieldDefSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().min(1)).optional(),
    referenceEntity: z.string().min(1).optional(),
  })
  .superRefine((field, context) => {
    if (field.type === 'enum' && (!field.options || field.options.length === 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'enum-Feld braucht mindestens eine Option.' });
    }
    if (field.type === 'reference' && !field.referenceEntity) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['referenceEntity'], message: 'reference-Feld braucht referenceEntity.' });
    }
  });
export type FieldDefDto = z.infer<typeof fieldDefSchema>;

export const createEntitySchema = z.object({
  name: z.string().min(1),
  fields: z.array(fieldDefSchema).min(1),
});
export type CreateEntityDto = z.infer<typeof createEntitySchema>;
