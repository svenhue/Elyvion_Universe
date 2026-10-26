import { z } from 'zod';
import { FIELD_TYPES } from '../schemas/entity-definition.schema';

export const fieldDefSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().min(1)).optional(),
    referenceEntity: z.string().min(1).optional(),
    transitions: z.record(z.string(), z.array(z.string())).optional(),
  })
  .superRefine((field, context) => {
    if ((field.type === 'enum' || field.type === 'multi_enum') && (!field.options || field.options.length === 0)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'enum-Feld braucht mindestens eine Option.' });
    }
    if ((field.type === 'reference' || field.type === 'multi_reference') && !field.referenceEntity) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['referenceEntity'], message: 'reference-Feld braucht referenceEntity.' });
    }
    if (field.transitions && field.type !== 'enum') {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['transitions'], message: 'transitions ist nur für enum-Felder gültig.' });
    }
    if (field.transitions && field.options) {
      const validValues = new Set(field.options);
      for (const [from, tos] of Object.entries(field.transitions)) {
        if (!validValues.has(from)) {
          context.addIssue({ code: z.ZodIssueCode.custom, path: ['transitions', from], message: `"${from}" ist keine gültige Option.` });
        }
        for (const to of tos) {
          if (!validValues.has(to)) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['transitions', from], message: `"${to}" ist keine gültige Option.` });
          }
        }
      }
    }
  });
export type FieldDefDto = z.infer<typeof fieldDefSchema>;

export const createEntitySchema = z.object({
  name: z.string().min(1),
  fields: z.array(fieldDefSchema).min(1),
});
export type CreateEntityDto = z.infer<typeof createEntitySchema>;
