import { Injectable, inject } from '@angular/core';
import { ApiClientService } from '@elyvion/shared-lib';

export interface TrafficEvent {
  id: string;
  observedAt: string;
  direction: 'client' | 'server';
  protocol: 'http' | 'https';
  sourceService: string;
  targetService: string;
  method: string;
  path: string;
  statusCode: number | null;
  requestBytes: number | null;
  responseBytes: number | null;
  durationMs: number | null;
  correlationId: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}

@Injectable({ providedIn: 'root' })
export class TrafficEventsApiService {
  private readonly api = inject(ApiClientService);

  list(tenantId: string, offset: number) {
    return this.api.get<TrafficEvent[]>(
      'traffic',
      `/events?limit=50&offset=${offset}`,
      { 'x-tenant-id': tenantId },
    );
  }
}
