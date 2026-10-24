import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
  @Prop({ required: true, default: 'Neue Unterhaltung' })
  title!: string;

  /** `"chat"` replies via the LLM directly; `"agent"` runs a multi-agent system via `agent-engine` (see `ChatService.postMessage` / `AgentEngineClient`). */
  @Prop({ required: true, enum: ['chat', 'agent'], default: 'chat' })
  mode!: 'chat' | 'agent';

  // Populated by Mongoose itself (`timestamps: true` above) — declared,
  // not `@Prop()`-decorated, purely so TypeScript knows these exist.
  createdAt!: Date;
  updatedAt!: Date;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
