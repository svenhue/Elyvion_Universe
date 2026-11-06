import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { readFileSync } from 'node:fs';

export interface RemoteUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * HTTP client to the Security service, which owns account and tenant
 * data. Auth no longer keeps its own copy of user data — it only
 * verifies credentials and builds OIDC claims by calling out to the
 * single source of truth. Called directly (not through the Gateway):
 * this is backend-to-backend traffic, same as registerModule().
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly securityServiceUrl = process.env.SECURITY_SERVICE_URL ?? 'http://localhost:3022';
  private readonly serviceToken = readSecretToken(
    'SECURITY_INTERNAL_TOKEN_FILE',
    process.env.SECURITY_INTERNAL_TOKEN ?? process.env.USERS_SERVICE_TOKEN,
  );

  async verifyCredentials(email: string, password: string): Promise<RemoteUser | null> {
    try {
      const response = await axios.post<{ data: RemoteUser }>(
        `${this.securityServiceUrl}/internal/users/verify-credentials`,
        { email, password },
        {
          timeout: 5000,
          headers: this.serviceToken ? { 'x-security-internal-token': this.serviceToken } : {},
        },
      );
      return response.data.data;
    } catch {
      return null;
    }
  }

  async findById(id: string): Promise<RemoteUser | null> {
    try {
      const response = await axios.get<{ data: RemoteUser }>(
        `${this.securityServiceUrl}/internal/users/by-id/${encodeURIComponent(id)}`,
        {
          timeout: 5000,
          headers: this.serviceToken ? { 'x-security-internal-token': this.serviceToken } : {},
        },
      );
      return response.data.data;
    } catch (err) {
      this.logger.warn(`Could not load user "${id}" from Security service: ${(err as Error).message}`);
      return null;
    }
  }
}

function readSecretToken(fileVariable: string, fallback: string | undefined): string | undefined {
  const filePath = process.env[fileVariable];
  if (!filePath) return fallback;
  try {
    const token = readFileSync(filePath, 'utf8').trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}
