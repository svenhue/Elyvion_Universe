import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { Rule, RuleBlock } from './rules-engine-schema';

/** Talks to the `rules-engine` backend module. */
@Injectable({ providedIn: 'root' })
export class RulesEngineApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'rules-engine';

  list() {
    return this.api.get<Rule[]>(RulesEngineApiService.MODULE, '/rules').pipe(map((r) => r.data));
  }

  create(key: string, name: string, description?: string) {
    return this.api
      .post<Rule>(RulesEngineApiService.MODULE, '/rules', { key, name, description })
      .pipe(map((r) => r.data));
  }

  updateBlocks(key: string, blocks: RuleBlock[]) {
    return this.api.patch<Rule>(RulesEngineApiService.MODULE, `/rules/${key}`, { blocks }).pipe(map((r) => r.data));
  }

  remove(key: string) {
    return this.api.delete<void>(RulesEngineApiService.MODULE, `/rules/${key}`);
  }

  execute(key: string, input: unknown) {
    return this.api
      .post<{ output: unknown }>(RulesEngineApiService.MODULE, `/rules/${key}/execute`, { input })
      .pipe(map((r) => r.data.output));
  }
}
