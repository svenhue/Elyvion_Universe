/**
 * Static client registry for the skeleton. Each client's redirect_uris is an
 * explicit allowlist, as required by the OAuth 2.1 / OIDC spec — the
 * Authorization Server (this module) rejects any redirect_uri not listed
 * here. Add one entry per customer frontend; move this to a DB-backed
 * registration flow once you need self-service client management.
 */
export const clients = [
  {
    client_id: 'elyvion-client',
    client_name: 'Elyvion Frontend Skeleton',
    application_type: 'web',
    token_endpoint_auth_method: 'none', // public SPA client — enforced via PKCE instead of a secret
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    redirect_uris: [
      'http://localhost:4200/auth/callback',
      'http://localhost:4300/auth/callback',
    ],
    post_logout_redirect_uris: ['http://localhost:4200/', 'http://localhost:4300/'],
    scope: 'openid profile email offline_access',
  },
];
