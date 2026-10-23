import { createRemoteJWKSet } from 'jose';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getRemoteJwks(issuerUrl: string) {
  const existing = jwksCache.get(issuerUrl);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${issuerUrl}/jwks`));
  jwksCache.set(issuerUrl, jwks);
  return jwks;
}
