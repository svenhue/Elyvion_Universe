import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * An action owned and implemented by another backend module — the
 * generalization that lets *any* module ("jedes Modul... sollte
 * exposen, welche Aktion es zur Verfügung stellt") expose actions
 * without actions-engine having to know about it in code. `path` may
 * contain `{paramName}` placeholders (e.g. `/configs/{applicationId}`),
 * filled from the execute call's input before whatever's left becomes
 * the request body — see `RemoteActionsService.execute`.
 */
@Schema({ collection: 'remote_actions' })
export class RemoteAction {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop()
  category?: string;

  @Prop({ type: Object, required: true })
  inputSchema!: Record<string, unknown>;

  /** The module's own Registry name — resolved at call time, not cached, so it stays correct across restarts/redeploys. */
  @Prop({ required: true })
  moduleName!: string;

  @Prop({ required: true })
  path!: string;

  @Prop({ required: true, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' })
  method!: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** `"resourceKey:permissionKey"`, checked against the `security` module before this action runs — see `ActionsController.execute`. Absent means "no gate" (most built-in/diagnostic actions). */
  @Prop()
  requiredPermission?: string;

  @Prop({ default: Date.now })
  updatedAt!: Date;
}

export type RemoteActionDocument = HydratedDocument<RemoteAction>;
export const RemoteActionSchema = SchemaFactory.createForClass(RemoteAction);
