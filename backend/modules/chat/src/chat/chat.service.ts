import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateConversationDto } from './dto/chat.dto';
import { LlmService } from './llm/llm.service';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';

export interface ConversationRecord {
  id: string;
  title: string;
  mode: 'chat' | 'agent';
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversations: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messages: Model<MessageDocument>,
    private readonly llm: LlmService,
  ) {}

  async createConversation(dto: CreateConversationDto): Promise<ConversationRecord> {
    const doc = await this.conversations.create({ title: dto.title ?? 'Neue Unterhaltung', mode: dto.mode ?? 'chat' });
    return toConversationRecord(doc);
  }

  async listConversations(): Promise<ConversationRecord[]> {
    const docs = await this.conversations.find().sort({ updatedAt: -1 }).lean();
    return docs.map(toConversationRecord);
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const docs = await this.messages.find({ conversationId }).sort({ createdAt: 1 }).lean();
    return docs.map(toMessageRecord);
  }

  /** Saves the user's message, then — for a `"chat"` conversation — replies via the LLM. A `"agent"` conversation 400s: there's no agent-engine to run one against yet. */
  async postMessage(conversationId: string, content: string): Promise<MessageRecord> {
    const conversation = await this.conversations.findById(conversationId).lean();
    if (!conversation) {
      throw new NotFoundException(`Unterhaltung "${conversationId}" wurde nicht gefunden.`);
    }
    if (conversation.mode === 'agent') {
      throw new BadRequestException('Multi-Agent-Modus ist noch nicht verfügbar — folgt mit agent-engine.');
    }

    await this.messages.create({ conversationId, role: 'user', content });
    const history = await this.listMessages(conversationId);
    const reply = await this.llm.complete(history.map((message) => ({ role: message.role, content: message.content })));

    const assistantDoc = await this.messages.create({ conversationId, role: 'assistant', content: reply });
    await this.conversations.updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } });
    return toMessageRecord(assistantDoc.toObject());
  }
}

function toConversationRecord(doc: Conversation & { _id: unknown }): ConversationRecord {
  return {
    id: String(doc._id),
    title: doc.title,
    mode: doc.mode,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toMessageRecord(doc: Message & { _id: unknown }): MessageRecord {
  return {
    id: String(doc._id),
    conversationId: doc.conversationId,
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
  };
}
