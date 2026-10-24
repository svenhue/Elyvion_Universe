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

export interface CreateConversationPayload {
  title?: string;
  mode?: 'chat' | 'agent';
}
