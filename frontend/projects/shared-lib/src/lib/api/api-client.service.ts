import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ELYVION_GATEWAY_URL } from './gateway-url.token';

export interface ResponseEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Thin HttpClient wrapper targeting the Gateway (`/api/{module}/...`). The
 * JWT auth header is attached automatically by the auth interceptor, not
 * here — this class only knows about request shapes and the envelope.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(ELYVION_GATEWAY_URL);

  get<T>(moduleName: string, path: string) {
    return this.http.get<ResponseEnvelope<T>>(`${this.gatewayUrl}/api/${moduleName}${path}`);
  }

  post<T>(moduleName: string, path: string, body: unknown) {
    return this.http.post<ResponseEnvelope<T>>(`${this.gatewayUrl}/api/${moduleName}${path}`, body);
  }

  patch<T>(moduleName: string, path: string, body: unknown) {
    return this.http.patch<ResponseEnvelope<T>>(`${this.gatewayUrl}/api/${moduleName}${path}`, body);
  }
}
