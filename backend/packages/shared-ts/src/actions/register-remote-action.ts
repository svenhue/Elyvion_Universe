import axios from 'axios';

export interface RegisterRemoteActionOptions {
  actionsEngineUrl: string;
  key: string;
  name: string;
  description: string;
  category?: string;
  /** JSON Schema, not zod — this crosses a module boundary. */
  inputSchema: Record<string, unknown>;
  /** This module's own Registry name — actions-engine resolves it at call time. */
  moduleName: string;
  /** May contain `{paramName}` placeholders, filled from the execute call's input (see actions-engine's `RemoteActionsService`). */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** `"resourceKey:permissionKey"` — checked against the `security` module before this action runs. Omit for actions that don't need gating. */
  requiredPermission?: string;
}

/**
 * Self-registration a module calls once from its own `main.ts` on
 * bootstrap — the generalization that lets *any* module expose its own
 * actions ("jedes Modul... sollte exposen, welche Aktion es zur
 * Verfügung stellt") without actions-engine needing code for it, mirroring
 * `registerModule`'s own self-registration with the Registry.
 */
export async function registerRemoteAction(
  options: RegisterRemoteActionOptions,
  retries = 5,
  delayMs = 2000,
): Promise<void> {
  const { actionsEngineUrl, ...payload } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(`${actionsEngineUrl}/remote-actions`, payload, { timeout: 3000 });
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error(
          `[registerRemoteAction] Failed to register "${options.key}" with actions-engine after ${retries} attempts:`,
          err instanceof Error ? err.message : err,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
