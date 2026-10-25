import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'text', 'enum', 'reference'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * `text`/`enum`/`reference` added for apps like Jira/Confluence that need
 * more than scalar fields: `text` is still a plain string, just a hint to
 * the App-Builder to render a multiline/longer control instead of a
 * single-line one; `enum` is a fixed set of allowed values (`options`,
 * required for this type) — a Jira "status" or "priority" without one is
 * just a free-text field pretending to have states; `reference` points at
 * another entity by name (`referenceEntity`, required) and stores the
 * referenced record's `id` as a plain string — no join/population on
 * read, the owning app resolves it (e.g. the App-Builder's `list` node
 * uses it to filter, see dynamic-app-schema.ts).
 */
@Schema({ _id: false })
export class FieldDef {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: FIELD_TYPES })
  type!: FieldType;

  @Prop({ required: true, default: false })
  required!: boolean;

  /** `enum` only — the fixed set of allowed values. */
  @Prop({ type: [String] })
  options?: string[];

  /** `reference` only — the name of the entity this field points at. */
  @Prop()
  referenceEntity?: string;
}
export const FieldDefSchema = SchemaFactory.createForClass(FieldDef);

/**
 * One user-defined entity's shape — this document is the only thing
 * `EntityRegistryService` needs to provision the matching data
 * collection (a dynamically-registered Mongoose model, built from
 * `fields`) and to validate records against it on every write.
 */
@Schema({ timestamps: true, collection: 'entity_definitions' })
export class EntityDefinition {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ type: [FieldDefSchema], required: true })
  fields!: FieldDef[];

  // Populated by Mongoose itself (`timestamps` above) — declared, not
  // `@Prop()`-decorated, purely so TypeScript knows these exist.
  createdAt!: Date;
  updatedAt!: Date;
}

export type EntityDefinitionDocument = HydratedDocument<EntityDefinition>;
export const EntityDefinitionSchema = SchemaFactory.createForClass(EntityDefinition);
