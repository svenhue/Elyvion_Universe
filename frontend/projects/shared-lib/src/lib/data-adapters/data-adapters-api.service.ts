import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { CreateDataAdapterInput, DataAdapterConfig, DataAdapterRun } from './data-adapters-schema';

/** Talks to the `data-adapters` backend module. */
@Injectable({ providedIn: 'root' })
export class DataAdaptersApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'data-adapters';

  list() {
    return this.api.get<DataAdapterConfig[]>(DataAdaptersApiService.MODULE, '/adapters').pipe(map((r) => r.data));
  }

  create(input: CreateDataAdapterInput) {
    return this.api.post<DataAdapterConfig>(DataAdaptersApiService.MODULE, '/adapters', input).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete(DataAdaptersApiService.MODULE, `/adapters/${id}`);
  }

  triggerRun(id: string) {
    return this.api.post<DataAdapterRun>(DataAdaptersApiService.MODULE, `/adapters/${id}/runs`, {}).pipe(map((r) => r.data));
  }

  listRuns(id: string) {
    return this.api.get<DataAdapterRun[]>(DataAdaptersApiService.MODULE, `/adapters/${id}/runs`).pipe(map((r) => r.data));
  }

  schedule(id: string, schedule: string | null) {
    return this.api
      .patch<DataAdapterConfig>(DataAdaptersApiService.MODULE, `/adapters/${id}/schedule`, { schedule })
      .pipe(map((r) => r.data));
  }
}
