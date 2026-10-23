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
        card: () => import('@elyvion/shared-lib').then((m) => m.ElvCardComponent),
        'text-input': () => import('@elyvion/shared-lib').then((m) => m.ElvTextInputComponent),
        textarea: () => import('@elyvion/shared-lib').then((m) => m.ElvTextareaComponent),
        checkbox: () => import('@elyvion/shared-lib').then((m) => m.ElvCheckboxComponent),
        select: () => import('@elyvion/shared-lib').then((m) => m.ElvSelectComponent),
        toggle: () => import('@elyvion/shared-lib').then((m) => m.ElvToggleComponent),
        slider: () => import('@elyvion/shared-lib').then((m) => m.ElvSliderComponent),
        badge: () => import('@elyvion/shared-lib').then((m) => m.ElvBadgeComponent),
        alert: () => import('@elyvion/shared-lib').then((m) => m.ElvAlertComponent),
        avatar: () => import('@elyvion/shared-lib').then((m) => m.ElvAvatarComponent),
        spinner: () => import('@elyvion/shared-lib').then((m) => m.ElvSpinnerComponent),
        progress: () => import('@elyvion/shared-lib').then((m) => m.ElvProgressComponent),
        tooltip: () => import('@elyvion/shared-lib').then((m) => m.ElvTooltipComponent),
        modal: () => import('@elyvion/shared-lib').then((m) => m.ElvModalComponent),
        tabs: () => import('@elyvion/shared-lib').then((m) => m.ElvTabsComponent),
        accordion: () => import('@elyvion/shared-lib').then((m) => m.ElvAccordionComponent),
        dropdown: () => import('@elyvion/shared-lib').then((m) => m.ElvDropdownComponent),
        pagination: () => import('@elyvion/shared-lib').then((m) => m.ElvPaginationComponent),
        divider: () => import('@elyvion/shared-lib').then((m) => m.ElvDividerComponent),
        skeleton: () => import('@elyvion/shared-lib').then((m) => m.ElvSkeletonComponent),
        'form-field': () => import('@elyvion/shared-lib').then((m) => m.ElvFormFieldComponent),
      },
    },
    provideAdminResources(ADMIN_RESOURCE_CONFIGS),
  ],
};
