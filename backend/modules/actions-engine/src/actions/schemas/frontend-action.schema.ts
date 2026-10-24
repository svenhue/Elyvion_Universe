import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

/**
 * A frontend action's manifest entry — metadata only. actions-engine can't
 * reach into a user's browser to run one itself; the Angular app registers
 * its own executable actions here (mirroring the Registry's module
 * self-registration) purely so they show up in `GET /actions` and the
 * Actions panel, and so a workflow step can reference them by key.
 */
@Schema({ collection: 'frontend_actions' })
export class FrontendAction {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop()
  category?: string;

  /** JSON Schema (not a zod instance — zod doesn't cross the wire), describing this action's input shape. */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  inputSchema!: Record<string, unknown>;

  /** `"resourceKey:permissionKey"` — the Angular app's own `FrontendActionsService.execute` checks this against the `security` module before running the action. */
  @Prop()
  requiredPermission?: string;

  @Prop({ default: Date.now })
  updatedAt!: Date;
}

export type FrontendActionDocument = HydratedDocument<FrontendAction>;
export const FrontendActionSchema = SchemaFactory.createForClass(FrontendAction);
