import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../../api/api-client.service';

/** One `app-config` document's management-list shape — `GET /configs` doesn't need the full `components` tree. */
export interface AppConfigSummary {
  applicationId: string;
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/** Talks to the `app-config` backend module's management endpoints (not the schema-resolve one `DynamicAppService` uses). */
@Injectable({ providedIn: 'root' })
export class AppConfigApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'app-config';

  list() {
    return this.api.get<AppConfigSummary[]>(AppConfigApiService.MODULE, '/configs').pipe(map((r) => r.data));
  }

  remove(applicationId: string) {
    return this.api.delete<void>(AppConfigApiService.MODULE, `/configs/${applicationId}`);
  }
}
