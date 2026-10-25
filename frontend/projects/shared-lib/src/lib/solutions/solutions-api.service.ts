import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { Solution, SolutionMember } from './solutions-schema';

/** Talks to the `solutions` backend module. */
@Injectable({ providedIn: 'root' })
export class SolutionsApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'solutions';

  list(sourceRepositoryKey?: string) {
    const query = sourceRepositoryKey ? `?sourceRepositoryKey=${encodeURIComponent(sourceRepositoryKey)}` : '';
    return this.api.get<Solution[]>(SolutionsApiService.MODULE, `/solutions${query}`).pipe(map((r) => r.data));
  }

  create(key: string, name: string, description?: string, sourceRepositoryKey?: string) {
    return this.api
      .post<Solution>(SolutionsApiService.MODULE, '/solutions', { key, name, description, sourceRepositoryKey })
      .pipe(map((r) => r.data));
  }

  /** Replaces a Solution's entire member list in one call — how "Repository deployen" (update mode) snapshots a repository's current members onto it. */
  setMembers(key: string, members: SolutionMember[]) {
    return this.api
      .patch<Solution>(SolutionsApiService.MODULE, `/solutions/${key}/members`, { members })
      .pipe(map((r) => r.data));
  }

  remove(key: string) {
    return this.api.delete<void>(SolutionsApiService.MODULE, `/solutions/${key}`);
  }

  addMember(key: string, member: SolutionMember) {
    return this.api
      .post<Solution>(SolutionsApiService.MODULE, `/solutions/${key}/members`, member)
      .pipe(map((r) => r.data));
  }

  removeMember(key: string, resourceType: string, resourceKey: string) {
    return this.api
      .delete<Solution>(SolutionsApiService.MODULE, `/solutions/${key}/members/${resourceType}/${resourceKey}`)
      .pipe(map((r) => r.data));
  }
}
