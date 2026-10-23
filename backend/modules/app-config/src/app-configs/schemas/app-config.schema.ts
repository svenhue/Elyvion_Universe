import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * Mirrors the frontend's DynamicAppSchema (see
 * frontend/projects/shared-lib/src/lib/dynamic-render/schema). This is the
 * persistence side of that same meta-schema: one document per application.
 */
@Schema({ _id: false })
export class ComponentNode {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  attributes?: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  children?: string[];
}
export const ComponentNodeSchema = SchemaFactory.createForClass(ComponentNode);

@Schema({ collection: 'app_configs', timestamps: true })
export class AppConfig {
  @Prop({ required: true, unique: true, index: true })
  applicationId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, default: '1.0.0' })
  version!: string;

  @Prop({ required: true })
  rootComponentId!: string;

  @Prop({ type: [ComponentNodeSchema], default: [] })
  components!: ComponentNode[];
}

export type AppConfigDocument = HydratedDocument<AppConfig>;
export const AppConfigSchema = SchemaFactory.createForClass(AppConfig);
