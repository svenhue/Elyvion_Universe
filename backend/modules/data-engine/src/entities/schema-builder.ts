import { Schema as MongooseSchema } from 'mongoose';
import { z } from 'zod';
import { FieldDef, FieldType } from './schemas/entity-definition.schema';

const MONGOOSE_TYPE_BY_FIELD_TYPE: Record<FieldType, unknown> = {
  string: String,
  number: Number,
  boolean: Boolean,
  date: Date,
  text: String,
  enum: String,
  reference: String,
};

/** The collection a defined entity's own records live in — sanitized so a user-chosen entity name can't collide with or inject into another collection. */
export function dataCollectionName(entityName: string): string {
  return `data_${entityName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

/** Builds the Mongoose schema `EntityRegistryService` registers a dynamic model with — one `required`-aware field per `FieldDef`, plus an `enum` validator where the definition declares `options`, nothing else. */
export function buildMongooseSchema(fields: FieldDef[]): MongooseSchema {
  const definition: Record<string, { type: unknown; required: boolean; enum?: string[] }> = {};
  for (const field of fields) {
    definition[field.name] = {
      type: MONGOOSE_TYPE_BY_FIELD_TYPE[field.type],
      required: field.required,
      ...(field.type === 'enum' && field.options ? { enum: field.options } : {}),
    };
  }
  return new MongooseSchema(definition, { timestamps: true, strict: true });
}

/** Builds a zod schema from `FieldDef[]`, so a record's input is rejected with a clear 400 for a wrong type, an out-of-range `enum` value, or a missing required field — before it ever reaches Mongoose. */
export function buildRecordSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    const base: z.ZodTypeAny = fieldSchema(field);
    shape[field.name] = field.required ? base : base.optional();
  }
  return z.object(shape);
}

function fieldSchema(field: FieldDef): z.ZodTypeAny {
  switch (field.type) {
    case 'string':
    case 'text':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'date':
      return z.coerce.date();
    case 'enum':
      return field.options && field.options.length > 0 ? z.enum(field.options as [string, ...string[]]) : z.string();
    case 'reference':
      // Just the referenced record's id — existence isn't checked here (no
      // cross-entity lookup at write time), the owning app is responsible
      // for only ever setting a real id.
      return z.string();
  }
}

/** Coerces a raw query-string filter value (e.g. `?status=Done`) to the type `buildMongooseSchema` stored that field as, so `Model.find({ [name]: value })` actually matches instead of silently returning nothing on a type mismatch. */
export function coerceFilterValue(type: FieldType, raw: string): unknown {
  switch (type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'date':
      return new Date(raw);
    default:
      return raw;
  }
}
