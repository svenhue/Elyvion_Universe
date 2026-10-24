import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { HealthCheckResult, HealthTargetStatus } from './telemetry-schema';

/** Talks to the `telemetry` backend module. */
@Injectable({ providedIn: 'root' })
export class TelemetryApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'telemetry';

  status() {
    return this.api.get<HealthTargetStatus[]>(TelemetryApiService.MODULE, '/health/status').pipe(map((r) => r.data));
  }

  history(targetId: string, limit = 50) {
    return this.api
      .get<HealthCheckResult[]>(TelemetryApiService.MODULE, `/health/targets/${targetId}/history?limit=${limit}`)
      .pipe(map((r) => r.data));
  }
}
