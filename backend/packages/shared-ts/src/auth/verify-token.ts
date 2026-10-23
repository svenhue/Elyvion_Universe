import { jwtVerify, JWTPayload } from 'jose';
import { getRemoteJwks } from './jwks';

export async function verifyBearerToken(
  authorizationHeader: string | undefined,
  issuerUrl: string,
  expectedAudience?: string,
): Promise<JWTPayload> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new Error('Missing bearer token');
  }
  const token = authorizationHeader.slice('Bearer '.length);
  const jwks = getRemoteJwks(issuerUrl);
  const { payload } = await jwtVerify(token, jwks, {
    issuer: issuerUrl,
    audience: expectedAudience,
  });
  return payload;
}
