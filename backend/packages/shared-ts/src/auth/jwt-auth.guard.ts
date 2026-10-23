import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JWTPayload } from 'jose';
import { verifyBearerToken } from './verify-token';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Validates Bearer JWTs against the Auth module's JWKS endpoint (standard
 * OIDC discovery: {issuer}/jwks).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly issuerUrl: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      request.user = await verifyBearerToken(request.headers.authorization, this.issuerUrl);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
