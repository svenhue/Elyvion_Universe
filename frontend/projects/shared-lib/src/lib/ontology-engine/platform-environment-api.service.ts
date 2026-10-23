import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ELYVION_GATEWAY_URL } from '../api/gateway-url.token';

export interface PlatformEnvironmentSettings {
  enabled: boolean;
}

export interface PlatformEnvironmentSyncResult {
  nodes: number;
  edges: number;
}

/** Talks to the `ontology-engine` module's `environment` submodule — the "observer" that mirrors the running platform itself into the `"platform-environment"` ontology. */
@Injectable({ providedIn: 'root' })
export class PlatformEnvironmentApiService {
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(ELYVION_GATEWAY_URL);
  private readonly base = `${this.gatewayUrl}/api/ontology-engine/environment`;

  getSettings(): Observable<PlatformEnvironmentSettings> {
    return this.http.get<PlatformEnvironmentSettings>(`${this.base}/settings`);
  }

  setSettings(enabled: boolean): Observable<PlatformEnvironmentSettings> {
    return this.http.put<PlatformEnvironmentSettings>(`${this.base}/settings`, { enabled });
  }

  triggerSync(): Observable<PlatformEnvironmentSyncResult> {
    return this.http.post<PlatformEnvironmentSyncResult>(`${this.base}/sync`, {});
  }
}
