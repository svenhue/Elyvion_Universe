/**
 * sessionStorage-backed token storage. Good enough for the skeleton; for a
 * hardened production setup, move token custody server-side (BFF pattern
 * with an httpOnly session cookie) instead of holding tokens in the browser.
 */
const ACCESS_TOKEN_KEY = 'elyvion.access_token';
const ID_TOKEN_KEY = 'elyvion.id_token';
const REFRESH_TOKEN_KEY = 'elyvion.refresh_token';
const PKCE_VERIFIER_KEY = 'elyvion.pkce_verifier';
const PKCE_STATE_KEY = 'elyvion.pkce_state';

export const tokenStore = {
  get accessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get idToken(): string | null {
    return sessionStorage.getItem(ID_TOKEN_KEY);
  },
  get refreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens: { access_token: string; id_token?: string; refresh_token?: string }): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    if (tokens.id_token) sessionStorage.setItem(ID_TOKEN_KEY, tokens.id_token);
    if (tokens.refresh_token) sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },
  clear(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(ID_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  setPkce(verifier: string, state: string): void {
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(PKCE_STATE_KEY, state);
  },
  consumePkce(): { verifier: string | null; state: string | null } {
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    const state = sessionStorage.getItem(PKCE_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    return { verifier, state };
  },
};
