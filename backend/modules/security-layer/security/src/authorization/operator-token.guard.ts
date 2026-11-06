import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Request } from 'express';

@Injectable()
export class OperatorTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-security-operator-token'];
    const tokenPath = process.env.SECURITY_OPERATOR_TOKEN_FILE;
    let expected = process.env.SECURITY_OPERATOR_TOKEN;
    if (tokenPath) {
      try {
        expected = readFileSync(tokenPath, 'utf8').trim();
      } catch {
        expected = undefined;
      }
    }
    if (!expected || typeof provided !== 'string') {
      throw new UnauthorizedException('Operator authentication is required');
    }

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid operator token');
    }
    return true;
  }
}
