/** An action's description, exactly as `actions-engine` returns it — `inputSchema` is JSON Schema (not zod; zod doesn't cross the wire). */
export interface ActionDescriptor {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  target: 'backend' | 'frontend';
}

export interface RegisterFrontendActionPayload {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
}
