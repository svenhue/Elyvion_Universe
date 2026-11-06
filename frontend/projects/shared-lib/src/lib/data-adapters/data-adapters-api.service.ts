import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { CreateDataAdapterInput, DataAdapterConfig, DataAdapterRun, DataAdapterScope } from './data-adapters-schema';

/** Talks to the `data-adapters` backend module. */
@Injectable({ providedIn: 'root' })
export class DataAdaptersApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'data-adapters';

  list(scope?: DataAdapterScope) {
    return this.api.get<DataAdapterConfig[]>(DataAdaptersApiService.MODULE, '/adapters', scopeHeaders(scope)).pipe(map((r) => r.data));
  }

  create(input: CreateDataAdapterInput, scope: DataAdapterScope) {
    return this.api
      .post<DataAdapterConfig>(DataAdaptersApiService.MODULE, '/adapters', input, scopeHeaders(scope))
      .pipe(map((r) => r.data));
  }

  remove(id: string, scope: DataAdapterScope) {
    return this.api.delete(DataAdaptersApiService.MODULE, `/adapters/${id}`, scopeHeaders(scope));
  }

  triggerRun(id: string, scope: DataAdapterScope) {
    return this.api
      .post<DataAdapterRun>(DataAdaptersApiService.MODULE, `/adapters/${id}/test`, {}, scopeHeaders(scope))
      .pipe(map((r) => r.data));
  }

  listRuns(id: string, scope: DataAdapterScope) {
    return this.api
      .get<DataAdapterRun[]>(DataAdaptersApiService.MODULE, `/adapters/${id}/runs`, scopeHeaders(scope))
      .pipe(map((r) => r.data));
  }

  schedule(id: string, schedule: string | null, scope: DataAdapterScope) {
    return this.api
      .patch<DataAdapterConfig>(
        DataAdaptersApiService.MODULE,
        `/adapters/${id}/schedule`,
        { schedule },
        scopeHeaders(scope),
      )
      .pipe(map((r) => r.data));
  }
}

function scopeHeaders(scope?: DataAdapterScope): Record<string, string> {
  if (!scope) return {};
  return {
    'x-tenant-id': scope.tenantId,
    'x-workspace-id': scope.workspaceId,
    'x-environment-id': scope.environmentId,
  };
}
