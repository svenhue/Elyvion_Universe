import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { ConversationRecord, CreateConversationPayload, MessageRecord } from './chat-schema';

/** Talks to the `chat` backend module. */
@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'chat';

  create(payload: CreateConversationPayload = {}): Observable<ConversationRecord> {
    return this.api
      .post<ConversationRecord>(ChatApiService.MODULE, '/conversations', payload)
      .pipe(map((response) => response.data));
  }

  list(): Observable<ConversationRecord[]> {
    return this.api
      .get<ConversationRecord[]>(ChatApiService.MODULE, '/conversations')
      .pipe(map((response) => response.data));
  }

  listMessages(conversationId: string): Observable<MessageRecord[]> {
    return this.api
      .get<MessageRecord[]>(ChatApiService.MODULE, `/conversations/${conversationId}/messages`)
      .pipe(map((response) => response.data));
  }

  /** Posts the user's message and resolves with the assistant's reply — the user's own message is saved either way, even if this then rejects (e.g. no LLM key configured, or an "agent" conversation with no agent-engine yet). */
  postMessage(conversationId: string, content: string): Observable<MessageRecord> {
    return this.api
      .post<MessageRecord>(ChatApiService.MODULE, `/conversations/${conversationId}/messages`, { content })
      .pipe(map((response) => response.data));
  }
}
