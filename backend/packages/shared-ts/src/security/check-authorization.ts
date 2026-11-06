import axios from 'axios';

export interface CheckAuthorizationOptions {
  securityUrl: string;
  /** `"resourceKey:permissionKey"`, as stored on an action's `requiredPermission`. */
  requiredPermission: string;
  authorization?: string;
  tenantId?: string;
  workspaceId?: string;
  environmentId?: string;
  objectId?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
  decision: 'ALLOW' | 'DENY';
}

/**
 * Calls the versioned PDP endpoint. Missing identity context, invalid
 * permission metadata, malformed responses, and PDP failures all deny.
 */
export async function checkAuthorization(options: CheckAuthorizationOptions): Promise<AuthorizationResult> {
  const [resourceKey, permissionKey, ...extra] = options.requiredPermission.split(':');
  if (!resourceKey || !permissionKey || extra.length > 0) {
    return { allowed: false, decision: 'DENY', reason: 'invalid requiredPermission format' };
  }
  if (!options.authorization?.startsWith('Bearer ')) {
    return { allowed: false, decision: 'DENY', reason: 'a valid bearer token is required' };
  }
  if (!options.tenantId?.trim()) {
    return { allowed: false, decision: 'DENY', reason: 'x-tenant-id is required' };
  }

  try {
    const response = await axios.post<{
      data?: { decision?: unknown; reason?: unknown };
    }>(
      `${options.securityUrl}/v1/authorize`,
      {
        action: permissionKey,
        resource: {
          type: resourceKey,
          ...(options.objectId ? { id: options.objectId } : {}),
          attributes: {
            ...(options.tenantId ? { tenantId: options.tenantId } : {}),
            ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
            ...(options.environmentId ? { environmentId: options.environmentId } : {}),
          },
        },
        context: options.environmentId ? { environment: options.environmentId } : {},
      },
      {
        headers: {
          authorization: options.authorization,
          'x-tenant-id': options.tenantId,
        },
        timeout: 5000,
      },
    );
    const decision = response.data.data;
    if (decision?.decision === 'ALLOW' || decision?.decision === 'DENY') {
      return {
        allowed: decision.decision === 'ALLOW',
        decision: decision.decision,
        reason: typeof decision.reason === 'string' ? decision.reason : 'no reason supplied',
      };
    }
    return { allowed: false, decision: 'DENY', reason: 'authorization service returned an invalid decision' };
  } catch {
    return { allowed: false, decision: 'DENY', reason: 'authorization service is unavailable' };
  }
}
