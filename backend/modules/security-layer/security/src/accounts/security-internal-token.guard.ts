import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Request } from 'express';

@Injectable()
export class SecurityInternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-security-internal-token'];
    const expected = readSecretToken(
      'SECURITY_INTERNAL_TOKEN_FILE',
      process.env.SECURITY_INTERNAL_TOKEN ?? process.env.USERS_SERVICE_TOKEN,
    );
    if (!expected || typeof provided !== 'string') {
      throw new UnauthorizedException('Internal service authentication is required.');
    }

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid internal service token.');
    }
    return true;
  }
}

function readSecretToken(fileVariable: string, fallback: string | undefined): string | undefined {
  const filePath = process.env[fileVariable] ?? process.env.USERS_SERVICE_TOKEN_FILE;
  if (!filePath) return fallback;
  try {
    const token = readFileSync(filePath, 'utf8').trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}
