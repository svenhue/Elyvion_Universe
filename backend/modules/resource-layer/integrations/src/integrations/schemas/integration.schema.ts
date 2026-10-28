import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** One configured connection to a third-party service — "notion" with one API key, say. Several `Integration`s can share the same `provider`, e.g. two different Jira sites. */
@Schema({ timestamps: true })
export class Integration {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  name!: string;

  /** Validated against the provider's own `connectionConfigSchema` at creation time, not here (keeps this schema provider-agnostic). */
  @Prop({ type: Object, required: true })
  connectionConfig!: Record<string, unknown>;

  createdAt!: Date;
  updatedAt!: Date;
}

export type IntegrationDocument = Integration & Document;
export const IntegrationSchema = SchemaFactory.createForClass(Integration);
