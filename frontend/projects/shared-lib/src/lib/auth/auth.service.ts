import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ELYVION_AUTH_CONFIG } from './auth.config';
import { decodeJwtPayload } from './jwt';
import { generatePkcePair, generateRandomString } from './pkce';
import { tokenStore } from './token-store';

interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * OAuth 2.1 Authorization Code flow with mandatory PKCE against the
 * Elyvion Auth module (oidc-provider). Public client — no client secret,
 * matching `token_endpoint_auth_method: 'none'` in clients.ts.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ELYVION_AUTH_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isAuthenticated = signal(this.isBrowser && !!tokenStore.accessToken);
  readonly claims = signal(this.readClaims());

  async login(): Promise<void> {
    if (!this.isBrowser) return;

    const { verifier, challenge } = await generatePkcePair();
    const state = generateRandomString(32);
    tokenStore.setPkce(verifier, state);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${this.config.issuer}/auth?${params.toString()}`;
  }

  /** Call from the route that matches `redirectUri` (e.g. /auth/callback). */
  async handleCallback(queryParams: URLSearchParams): Promise<void> {
    if (!this.isBrowser) return;

    const code = queryParams.get('code');
    const returnedState = queryParams.get('state');
    const { verifier, state } = tokenStore.consumePkce();

    if (!code || !returnedState || returnedState !== state || !verifier) {
      throw new Error('Invalid OAuth callback (missing code or state mismatch)');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: verifier,
    });

    const tokens = await firstValueFrom(
      this.http.post<TokenResponse>(`${this.config.issuer}/token`, body.toString(), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );

    tokenStore.setTokens(tokens);
    this.isAuthenticated.set(true);
    this.claims.set(this.readClaims());
  }

  logout(): void {
    if (!this.isBrowser) return;
    const idToken = tokenStore.idToken;
    tokenStore.clear();
    this.isAuthenticated.set(false);
    this.claims.set(null);

    const params = new URLSearchParams({
      post_logout_redirect_uri: this.config.postLogoutRedirectUri,
      ...(idToken ? { id_token_hint: idToken } : {}),
    });
    window.location.href = `${this.config.issuer}/session/end?${params.toString()}`;
  }

  getAccessToken(): string | null {
    return this.isBrowser ? tokenStore.accessToken : null;
  }

  private readClaims(): Record<string, unknown> | null {
    if (!this.isBrowser) return null;
    const idToken = tokenStore.idToken;
    return idToken ? decodeJwtPayload(idToken) : null;
  }
}
