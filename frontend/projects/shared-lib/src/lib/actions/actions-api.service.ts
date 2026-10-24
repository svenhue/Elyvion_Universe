import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { ActionDescriptor, RegisterFrontendActionPayload } from './action-schema';

/** Talks to the `actions-engine` backend module — the one place every action (backend- or frontend-target) is listed, and backend actions are actually executed. */
@Injectable({ providedIn: 'root' })
export class ActionsApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'actions-engine';

  list(): Observable<ActionDescriptor[]> {
    return this.api
      .get<ActionDescriptor[]>(ActionsApiService.MODULE, '/actions')
      .pipe(map((response) => response.data));
  }

  get(key: string): Observable<ActionDescriptor> {
    return this.api
      .get<ActionDescriptor>(ActionsApiService.MODULE, `/actions/${key}`)
      .pipe(map((response) => response.data));
  }

  /** Runs a `target: "backend"` action. A `target: "frontend"` key 400s here — run it through `FrontendActionsService` instead. */
  execute<TOutput = unknown>(key: string, input: Record<string, unknown>): Observable<TOutput> {
    return this.api
      .post<TOutput>(ActionsApiService.MODULE, `/execute/${key}`, input)
      .pipe(map((response) => response.data));
  }

  registerFrontendAction(payload: RegisterFrontendActionPayload): Observable<ActionDescriptor> {
    return this.api
      .post<ActionDescriptor>(ActionsApiService.MODULE, '/frontend-actions', payload)
      .pipe(map((response) => response.data));
  }
}
