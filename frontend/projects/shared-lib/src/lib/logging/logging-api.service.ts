import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { ListLogsFilter, LogEntry } from './logging-schema';

/** Talks to the `logging` backend module. */
@Injectable({ providedIn: 'root' })
export class LoggingApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'logging';

  list(filter: ListLogsFilter = {}): Observable<LogEntry[]> {
    const params = new URLSearchParams();
    if (filter.source) params.set('source', filter.source);
    if (filter.level) params.set('level', filter.level);
    if (filter.actionKey) params.set('actionKey', filter.actionKey);
    params.set('limit', String(filter.limit ?? 100));
    const query = params.toString();
    return this.api
      .get<LogEntry[]>(LoggingApiService.MODULE, `/logs?${query}`)
      .pipe(map((response) => response.data));
  }
}
