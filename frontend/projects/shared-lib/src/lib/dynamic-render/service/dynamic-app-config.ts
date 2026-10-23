import { InjectionToken } from '@angular/core';

export interface DynamicAppConfig {
  /**
   * Base URL of the backend endpoint that resolves a schema for
   * (applicationId, userId, settings) — typically the Gateway, routed to
   * whichever module owns dynamic-app definitions, e.g.
   * "http://localhost:3000/api/app-builder".
   */
  schemaEndpoint: string;
}

export const DYNAMIC_APP_CONFIG = new InjectionToken<DynamicAppConfig>('DYNAMIC_APP_CONFIG');
