import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  createAuthInterceptor,
  DYNAMIC_APP_CONFIG,
  DYNAMIC_COMPONENT_REGISTRY,
  ELYVION_AUTH_CONFIG,
  ELYVION_GATEWAY_URL,
  provideAdminResources,
} from '@elyvion/shared-lib';

import { ADMIN_RESOURCE_CONFIGS } from './admin/admin-resources';
import { routes } from './app.routes';

// Per-clone config: adjust these when cloning this app for a new customer
// project (or wire them up to a real environment/config endpoint).
const GATEWAY_URL = 'http://localhost:3000';
const AUTH_ISSUER_URL = 'http://localhost:3011';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([createAuthInterceptor([GATEWAY_URL])])),
    { provide: ELYVION_GATEWAY_URL, useValue: GATEWAY_URL },
    {
      provide: ELYVION_AUTH_CONFIG,
      useValue: {
        issuer: AUTH_ISSUER_URL,
        clientId: 'elyvion-client',
        redirectUri: 'http://localhost:4200/auth/callback',
        postLogoutRedirectUri: 'http://localhost:4200/',
        scope: 'openid profile email offline_access',
      },
    },
    { provide: DYNAMIC_APP_CONFIG, useValue: { schemaEndpoint: `${GATEWAY_URL}/api/app-config/schema` } },
    {
      provide: DYNAMIC_COMPONENT_REGISTRY,
      useValue: {
        button: () => import('@elyvion/shared-lib').then((m) => m.ElvButtonComponent),
      },
    },
    provideAdminResources(ADMIN_RESOURCE_CONFIGS),
  ],
};
