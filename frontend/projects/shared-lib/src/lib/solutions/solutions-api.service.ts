import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { Solution, SolutionMember } from './solutions-schema';

/** Talks to the `solutions` backend module. */
@Injectable({ providedIn: 'root' })
export class SolutionsApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'solutions';

  list() {
    return this.api.get<Solution[]>(SolutionsApiService.MODULE, '/solutions').pipe(map((r) => r.data));
  }

  create(key: string, name: string, description?: string) {
    return this.api
      .post<Solution>(SolutionsApiService.MODULE, '/solutions', { key, name, description })
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
