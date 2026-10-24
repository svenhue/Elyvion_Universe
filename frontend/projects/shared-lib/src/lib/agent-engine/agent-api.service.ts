import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ELYVION_GATEWAY_URL } from '../api/gateway-url.token';
import { AgentRun, PromptDef } from './agent-schema';

/**
 * Talks to the `agent-engine` backend module through the Gateway. Not
 * built on `ApiClientService` — like `ontology-engine`, this is a FastAPI
 * module that returns its Pydantic models directly, not wrapped in the
 * NestJS modules' `{data, meta?}` envelope.
 */
@Injectable({ providedIn: 'root' })
export class AgentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(ELYVION_GATEWAY_URL)}/api/agent-engine`;

  startRun(task: string): Observable<AgentRun> {
    return this.http.post<AgentRun>(`${this.base}/runs`, { task });
  }

  listRuns(): Observable<AgentRun[]> {
    return this.http.get<AgentRun[]>(`${this.base}/runs`);
  }

  getRun(id: string): Observable<AgentRun> {
    return this.http.get<AgentRun>(`${this.base}/runs/${id}`);
  }

  listPrompts(): Observable<PromptDef[]> {
    return this.http.get<PromptDef[]>(`${this.base}/prompts`);
  }

  updatePrompt(key: string, value: string): Observable<PromptDef> {
    return this.http.put<PromptDef>(`${this.base}/prompts/${key}`, { value });
  }
}
