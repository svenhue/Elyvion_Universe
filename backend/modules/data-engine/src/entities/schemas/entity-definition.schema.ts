import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class FieldDef {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, enum: ['string', 'number', 'boolean', 'date'] })
  type!: 'string' | 'number' | 'boolean' | 'date';

  @Prop({ required: true, default: false })
  required!: boolean;
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
