import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * One snapshot of one object, at one point in time. Generic on purpose —
 * `resourceType` + `resourceKey` identify the object (e.g. `"rule"` +
 * `"einkaufsrichtlinie"`), `snapshot` is whatever the owning module's
 * own record looked like right before that change. This module never
 * interprets `snapshot` or writes it back anywhere; restoring is the
 * owning module's job (see `version-control`'s README) — this is purely
 * the history ledger, the same "one generic cross-cutting service every
 * other module calls into" shape as `logging`.
 */
@Schema()
export class ObjectVersion {
  @Prop({ required: true })
  resourceType!: string;

  @Prop({ required: true })
  resourceKey!: string;

  @Prop({ required: true })
  version!: number;

  @Prop({ type: Object, required: true })
  snapshot!: Record<string, unknown>;

  @Prop()
  changedBy?: string;

  @Prop({ default: Date.now })
  createdAt!: Date;
}

export type ObjectVersionDocument = ObjectVersion & Document;
export const ObjectVersionSchema = SchemaFactory.createForClass(ObjectVersion);
ObjectVersionSchema.index({ resourceType: 1, resourceKey: 1, version: 1 }, { unique: true });
