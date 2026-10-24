import { Schema as MongooseSchema } from 'mongoose';
import { z } from 'zod';
import { FieldDef } from './schemas/entity-definition.schema';

const MONGOOSE_TYPE_BY_FIELD_TYPE = { string: String, number: Number, boolean: Boolean, date: Date } as const;

/** The collection a defined entity's own records live in — sanitized so a user-chosen entity name can't collide with or inject into another collection. */
export function dataCollectionName(entityName: string): string {
  return `data_${entityName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

/** Builds the Mongoose schema `EntityRegistryService` registers a dynamic model with — one `required`-aware field per `FieldDef`, nothing else (no extra validation beyond what the definition declares). */
export function buildMongooseSchema(fields: FieldDef[]): MongooseSchema {
  const definition: Record<string, { type: unknown; required: boolean }> = {};
  for (const field of fields) {
    definition[field.name] = { type: MONGOOSE_TYPE_BY_FIELD_TYPE[field.type], required: field.required };
  }
  return new MongooseSchema(definition, { timestamps: true, strict: true });
}

/** Builds a zod schema from `FieldDef[]`, so a record's input is rejected with a clear 400 for a wrong type or a missing required field — before it ever reaches Mongoose. */
export function buildRecordSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const base: z.ZodTypeAny =
      field.type === 'string'
        ? z.string()
        : field.type === 'number'
          ? z.number()
          : field.type === 'boolean'
            ? z.boolean()
            : z.coerce.date();
    shape[field.name] = field.required ? base : base.optional();
  }
  return z.object(shape);
}
