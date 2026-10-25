import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { RepositoryCopyRef, RepositoryMemberRef, RepositoryRecord } from './repository-schema';

/** Talks to the `repository` backend module — user-created, Mongo-backed Repositories (the Kernrepository itself is virtual, see repository.component.ts). */
@Injectable({ providedIn: 'root' })
export class RepositoriesApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'repository';

  list() {
    return this.api.get<RepositoryRecord[]>(RepositoriesApiService.MODULE, '/repositories').pipe(map((r) => r.data));
  }

  create(key: string, name: string, description?: string) {
    return this.api
      .post<RepositoryRecord>(RepositoriesApiService.MODULE, '/repositories', { key, name, description })
      .pipe(map((r) => r.data));
  }

  remove(key: string) {
    return this.api.delete<void>(RepositoriesApiService.MODULE, `/repositories/${key}`);
  }

  addMember(key: string, member: RepositoryMemberRef) {
    return this.api
      .post<RepositoryRecord>(RepositoriesApiService.MODULE, `/repositories/${key}/members`, member)
      .pipe(map((r) => r.data));
  }

  removeMember(key: string, resourceType: string, resourceKey: string) {
    return this.api
      .delete<RepositoryRecord>(RepositoriesApiService.MODULE, `/repositories/${key}/members/${resourceType}/${resourceKey}`)
      .pipe(map((r) => r.data));
  }

  /** Every Repository member copied from the given original — used right after an update to that original to offer "diese Kopien auch aktualisieren?". */
  copiesOf(resourceType: string, resourceKey: string) {
    return this.api
      .get<RepositoryCopyRef[]>(
        RepositoriesApiService.MODULE,
        `/repositories/copies?resourceType=${encodeURIComponent(resourceType)}&resourceKey=${encodeURIComponent(resourceKey)}`,
      )
      .pipe(map((r) => r.data));
  }
}
