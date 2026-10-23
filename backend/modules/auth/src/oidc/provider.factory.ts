import { clients } from './clients';
import { UsersService } from '../users/users.service';

const usersService = new UsersService();

/**
 * Single audience for every resource (Gateway + business modules) on this
 * platform. Declaring it as the default resource indicator (RFC 8707) is
 * what makes oidc-provider issue a JWT access token instead of its default
 * opaque, userinfo-only one — see features.resourceIndicators below.
 */
const API_AUDIENCE = process.env.API_AUDIENCE ?? 'elyvion:api';

/**
 * oidc-provider (certified OpenID Connect Provider implementation) gives us
 * discovery, JWKS, Authorization Code + PKCE, refresh token rotation and
 * token revocation/introspection for free instead of hand-rolling crypto.
 * oidc-provider is ESM-only, hence the dynamic import from this CJS NestJS app.
 */
export async function createOidcProvider(issuerUrl: string) {
  const { default: Provider } = await import('oidc-provider');

  const provider = new Provider(issuerUrl, {
    clients,
    pkce: {
      required: () => true,
    },
    claims: {
      openid: ['sub'],
      email: ['email'],
      profile: ['name', 'roles'],
    },
    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      introspection: { enabled: true },
      // Resource Indicators (RFC 8707) is oidc-provider's mechanism for
      // issuing self-contained JWT access tokens instead of its default
      // opaque, userinfo-only ones — required so the Gateway and any
      // module can verify tokens locally against JWKS.
      resourceIndicators: {
        enabled: true,
        defaultResource: () => API_AUDIENCE,
        useGrantedResource: () => true,
        getResourceServerInfo: () => ({
          scope: 'openid profile email offline_access',
          accessTokenFormat: 'jwt',
          jwt: { sign: { alg: 'RS256' } },
        }),
      },
    },
    ttl: {
      AccessToken: 60 * 60,
      AuthorizationCode: 60,
      IdToken: 60 * 60,
      RefreshToken: 60 * 60 * 24 * 14,
      Interaction: 60 * 10,
      Session: 60 * 60 * 24 * 30,
    },
    interactions: {
      url(_ctx, interaction) {
        return `/interaction/${interaction.uid}`;
      },
    },
    async findAccount(_ctx, id) {
      const user = await usersService.findById(id);
      if (!user) return undefined;
      return {
        accountId: user.id,
        async claims() {
          return {
            sub: user.id,
            email: user.email,
            name: user.name ?? undefined,
            roles: user.roles,
          };
        },
      };
    },
  });

  // Behind the Gateway/any reverse proxy, trust X-Forwarded-* so redirect_uri
  // and issuer checks use the public-facing scheme/host.
  provider.proxy = true;

  return provider;
}
