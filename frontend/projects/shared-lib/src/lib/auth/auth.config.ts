import { InjectionToken } from '@angular/core';

export interface ElyvionAuthConfig {
  /** Auth module's OIDC issuer, e.g. http://localhost:3011 */
  issuer: string;
  /** Must match an entry in backend/modules/security-layer/auth/src/oidc/clients.ts */
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
}

export const ELYVION_AUTH_CONFIG = new InjectionToken<ElyvionAuthConfig>('ELYVION_AUTH_CONFIG');
