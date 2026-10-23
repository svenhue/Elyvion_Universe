import { PrismaClient } from '../../generated/prisma';
import { clients } from './clients';

const prisma = new PrismaClient();

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
      profile: ['name'],
    },
    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      introspection: { enabled: true },
      resourceIndicators: { enabled: false },
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
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return undefined;
      return {
        accountId: user.id,
        async claims() {
          return { sub: user.id, email: user.email, name: user.name ?? undefined };
        },
      };
    },
  });

  // Behind the Gateway/any reverse proxy, trust X-Forwarded-* so redirect_uri
  // and issuer checks use the public-facing scheme/host.
  provider.proxy = true;

  return provider;
}
