import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'llm_configuration', timestamps: true })
export class LlmConfiguration {
  @Prop({ required: true, unique: true, default: 'global' })
  scope!: string;

  @Prop({ required: true })
  baseUrl!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true, min: 0, max: 2, default: 0.2 })
  temperature!: number;

  @Prop({ required: true, min: 1024, max: 131072, default: 8192 })
  numCtx!: number;

  updatedAt!: Date;
}

export type LlmConfigurationDocument = HydratedDocument<LlmConfiguration>;
export const LlmConfigurationSchema = SchemaFactory.createForClass(LlmConfiguration);
