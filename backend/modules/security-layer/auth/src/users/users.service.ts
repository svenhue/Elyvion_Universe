import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface RemoteUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

/**
 * HTTP client to modules/users, which owns the User/Role/Permission
 * tables. Auth no longer keeps its own copy of user data — it only
 * verifies credentials and builds OIDC claims by calling out to the
 * single source of truth. Called directly (not through the Gateway):
 * this is backend-to-backend traffic, same as registerModule().
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly usersServiceUrl = process.env.USERS_SERVICE_URL ?? 'http://localhost:3013';

  async verifyCredentials(email: string, password: string): Promise<RemoteUser | null> {
    try {
      const response = await axios.post<{ data: RemoteUser }>(
        `${this.usersServiceUrl}/verify-credentials`,
        { email, password },
        { timeout: 5000 },
      );
      return response.data.data;
    } catch {
      return null;
    }
  }

  async findById(id: string): Promise<RemoteUser | null> {
    try {
      const response = await axios.get<{ data: RemoteUser }>(`${this.usersServiceUrl}/by-id/${id}`, {
        timeout: 5000,
      });
      return response.data.data;
    } catch (err) {
      this.logger.warn(`Could not load user "${id}" from users service: ${(err as Error).message}`);
      return null;
    }
  }
}
