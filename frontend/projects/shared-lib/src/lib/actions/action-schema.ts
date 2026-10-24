/** An action's description, exactly as `actions-engine` returns it — `inputSchema` is JSON Schema (not zod; zod doesn't cross the wire). */
export interface ActionDescriptor {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  /** `"resourceKey:permissionKey"` — checked against `security` before this action runs, if set. */
  requiredPermission?: string;
  target: 'backend' | 'frontend';
}

export interface RegisterFrontendActionPayload {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  requiredPermission?: string;
}
