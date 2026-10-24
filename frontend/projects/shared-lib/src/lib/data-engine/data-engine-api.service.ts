import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { CreateEntityPayload, DataRecord, EntityDefinition } from './data-engine-schema';

/** Talks to the `data-engine` backend module. */
@Injectable({ providedIn: 'root' })
export class DataEngineApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'data-engine';

  listEntities(): Observable<EntityDefinition[]> {
    return this.api
      .get<EntityDefinition[]>(DataEngineApiService.MODULE, '/entities')
      .pipe(map((response) => response.data));
  }

  createEntity(payload: CreateEntityPayload): Observable<EntityDefinition> {
    return this.api
      .post<EntityDefinition>(DataEngineApiService.MODULE, '/entities', payload)
      .pipe(map((response) => response.data));
  }

  deleteEntity(name: string): Observable<void> {
    return this.api.delete(DataEngineApiService.MODULE, `/entities/${name}`).pipe(map(() => undefined));
  }

  listRecords(entity: string): Observable<DataRecord[]> {
    return this.api
      .get<DataRecord[]>(DataEngineApiService.MODULE, `/data/${entity}`)
      .pipe(map((response) => response.data));
  }

  createRecord(entity: string, input: Record<string, unknown>): Observable<DataRecord> {
    return this.api
      .post<DataRecord>(DataEngineApiService.MODULE, `/data/${entity}`, input)
      .pipe(map((response) => response.data));
  }

  updateRecord(entity: string, id: string, input: Record<string, unknown>): Observable<DataRecord> {
    return this.api
      .patch<DataRecord>(DataEngineApiService.MODULE, `/data/${entity}/${id}`, input)
      .pipe(map((response) => response.data));
  }

  deleteRecord(entity: string, id: string): Observable<void> {
    return this.api.delete(DataEngineApiService.MODULE, `/data/${entity}/${id}`).pipe(map(() => undefined));
  }
}
