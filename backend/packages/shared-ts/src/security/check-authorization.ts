import axios from 'axios';

export interface CheckAuthorizationOptions {
  securityUrl: string;
  /** `"resourceKey:permissionKey"`, as stored on an action's `requiredPermission`. */
  requiredPermission: string;
  subjectId?: string;
  subjectType?: 'user' | 'agent';
  objectId?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
}

/**
 * Calls the `security` module's `POST /authorize` — the one place that
 * decides "darf der Agent/Benutzer das?" before an action with a
 * `requiredPermission` runs (see actions-engine's `ActionsController`
 * and the frontend's `FrontendActionsService`). Unlike `logEvent`, this
 * is NOT fire-and-forget: a caller awaits it and must not run the action
 * if `allowed` is false. If the security module itself is unreachable,
 * this fails open (allowed: true) with a reason saying so — the same
 * "don't let infrastructure be a bigger outage than the thing it
 * protects" tradeoff `registerRemoteAction`'s retry loop makes, just
 * applied to a synchronous check instead of a retried one.
 */
export async function checkAuthorization(options: CheckAuthorizationOptions): Promise<AuthorizationResult> {
  const [resourceKey, permissionKey] = options.requiredPermission.split(':');
  try {
    const response = await axios.post<{ data: AuthorizationResult }>(
      `${options.securityUrl}/authorize`,
      { resourceKey, permissionKey, subjectId: options.subjectId, subjectType: options.subjectType, objectId: options.objectId },
      { timeout: 3000 },
    );
    return response.data.data;
  } catch (err) {
    return { allowed: true, reason: `security module unreachable, failing open: ${err instanceof Error ? err.message : err}` };
  }
}
