import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DynamicAppSchema } from '../schema/dynamic-app-schema';
import { DYNAMIC_APP_CONFIG } from './dynamic-app-config';

export interface LoadApplicationOptions {
  applicationId: string;
  userId: string;
  /** Arbitrary extra context the backend may use to tailor the schema (e.g. role, locale, feature flags). */
  settings?: Record<string, unknown>;
}

/**
 * The single entry point this module exposes to a host application:
 * resolve a DynamicAppSchema for a given application + user, ready to
 * hand to <elv-dynamic-renderer [schema]="...">.
 */
@Injectable({ providedIn: 'root' })
export class DynamicAppService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(DYNAMIC_APP_CONFIG);

  loadApplication(options: LoadApplicationOptions): Observable<DynamicAppSchema> {
    const { applicationId, userId, settings } = options;
    return this.http.post<DynamicAppSchema>(this.config.schemaEndpoint, {
      applicationId,
      userId,
      settings: settings ?? {},
    });
  }
}
