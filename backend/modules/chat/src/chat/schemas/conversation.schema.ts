import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ required: true, default: 'Neue Unterhaltung' })
  title!: string;

  /** `"agent"` conversations are accepted and stored, but `ChatService.postMessage` 400s on them until `agent-engine` exists (next phase) to actually run one. */
  @Prop({ required: true, enum: ['chat', 'agent'], default: 'chat' })
  mode!: 'chat' | 'agent';

  // Populated by Mongoose itself (`timestamps: true` above) — declared,
  // not `@Prop()`-decorated, purely so TypeScript knows these exist.
  createdAt!: Date;
  updatedAt!: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
