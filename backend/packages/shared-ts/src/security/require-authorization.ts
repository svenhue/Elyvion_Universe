import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';

export interface AuthorizationObligations {
  audit?: boolean;
  maskColumns?: string[];
  rowFilter?: Record<string, unknown>;
  requireMfa?: boolean;
  requireApproval?: boolean;
  maxRows?: number;
}

export interface RequireAuthorizationOptions {
  authorization: string | undefined;
  tenantId: string | undefined;
  action: string;
  resource: {
    type: string;
    id?: string;
    attributes?: Record<string, unknown>;
  };
  requestId?: string;
}

interface AuthorizationResponse {
  data?: {
    decision?: unknown;
    reason?: unknown;
    obligations?: unknown;
  };
}

export async function requireAuthorization(
  options: RequireAuthorizationOptions,
): Promise<AuthorizationObligations> {
  if (!options.authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedException('A valid bearer token is required');
  }
  if (!options.tenantId?.trim()) {
    throw new BadRequestException('x-tenant-id is required');
  }

  const securityUrl =
    process.env.SECURITY_SERVICE_URL ?? process.env.SECURITY_URL ?? 'http://localhost:3022';
  let response;
  try {
    response = await axios.post<AuthorizationResponse>(
      `${securityUrl}/v1/authorize`,
      {
        action: options.action,
        resource: {
          ...options.resource,
          attributes: options.resource.attributes ?? {},
        },
        context: options.requestId ? { requestId: options.requestId } : {},
      },
      {
        headers: {
          authorization: options.authorization,
          'x-tenant-id': options.tenantId,
          ...(options.requestId ? { 'x-correlation-id': options.requestId } : {}),
        },
        timeout: 5000,
      },
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleAuthorizationServiceError(error);
    }
    throw new ServiceUnavailableException('Authorization service request failed');
  }

  const decision = response.data.data;
  if (!decision || (decision.decision !== 'ALLOW' && decision.decision !== 'DENY')) {
    throw new BadGatewayException('Authorization service returned an invalid decision');
  }
  if (decision.decision === 'DENY') {
    const reason = typeof decision.reason === 'string' ? decision.reason : 'Access denied';
    throw new ForbiddenException(reason);
  }
  if (!isObligations(decision.obligations)) {
    throw new BadGatewayException('Authorization service returned invalid obligations');
  }
  return decision.obligations;
}

function handleAuthorizationServiceError(error: AxiosError): never {
  if (error.response?.status === 401) throw new UnauthorizedException('Invalid or expired token');
  if (error.response?.status === 403) throw new ForbiddenException('Access denied');
  if (error.response?.status === 400) throw new BadRequestException('Invalid authorization request');
  throw new ServiceUnavailableException('Authorization service is unavailable');
}

function isObligations(value: unknown): value is AuthorizationObligations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obligations = value as Record<string, unknown>;
  if (
    obligations['audit'] !== undefined && typeof obligations['audit'] !== 'boolean' ||
    obligations['maskColumns'] !== undefined &&
      (!Array.isArray(obligations['maskColumns']) || !obligations['maskColumns'].every((item) => typeof item === 'string')) ||
    obligations['rowFilter'] !== undefined &&
      (!obligations['rowFilter'] || typeof obligations['rowFilter'] !== 'object' || Array.isArray(obligations['rowFilter'])) ||
    obligations['requireMfa'] !== undefined && typeof obligations['requireMfa'] !== 'boolean' ||
    obligations['requireApproval'] !== undefined && typeof obligations['requireApproval'] !== 'boolean' ||
    obligations['maxRows'] !== undefined && (!Number.isInteger(obligations['maxRows']) || Number(obligations['maxRows']) < 1)
  ) {
    return false;
  }
  return true;
}
