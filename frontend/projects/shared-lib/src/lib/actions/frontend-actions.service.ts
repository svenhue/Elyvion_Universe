import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { ActionsApiService } from './actions-api.service';

export interface FrontendActionDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  /** `"resourceKey:permissionKey"` — checked against `security` before this action runs, if set. */
  requiredPermission?: string;
  run(input: TInput): Promise<TOutput> | TOutput;
}

interface AuthorizeResult {
  allowed: boolean;
  reason: string;
}

export interface FrontendActionAuthorizationScope {
  tenantId: string;
  workspaceId?: string;
  environmentId?: string;
}

/**
 * The frontend counterpart to actions-engine's backend `ActionsRegistry` —
 * same idea (a named, schema-described, callable action), but the handler
 * runs right here in the browser instead of over HTTP, for anything that's
 * inherently client-side (clipboard, navigation, UI state...). Registering
 * one also mirrors its manifest to actions-engine (`POST /frontend-actions`)
 * purely so it shows up in `GET /actions` next to backend ones — the
 * backend never calls the handler itself, it can't reach into this tab.
 */
@Injectable({ providedIn: 'root' })
export class FrontendActionsService {
  private readonly api = inject(ActionsApiService);
  private readonly apiClient = inject(ApiClientService);
  private readonly actions = new Map<string, FrontendActionDefinition>();
  private builtinsRegistered = false;

  register(definition: FrontendActionDefinition): void {
    this.actions.set(definition.key, definition);
    this.api
      .registerFrontendAction({
        key: definition.key,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        inputSchema: definition.inputSchema,
        requiredPermission: definition.requiredPermission,
      })
      .subscribe({
        error: (error: unknown) =>
          console.error(`[FrontendActionsService] Registrierung von "${definition.key}" fehlgeschlagen:`, error),
      });
  }

  /**
   * The one place every frontend action actually runs — so it's also the
   * one place that checks "darf der Benutzer das?" against `security`
   * (for actions that declare a `requiredPermission`) and logs every
   * call, success or failure, same as actions-engine's
   * `ActionsController.execute` does for backend ones ("eigentlich
   * sollte wirklich alles geloggt werden").
   */
  async execute(
    key: string,
    input: Record<string, unknown> = {},
    scope?: FrontendActionAuthorizationScope,
  ): Promise<unknown> {
    const definition = this.actions.get(key);
    if (!definition) {
      throw new Error(`Frontend-Action "${key}" ist in diesem Tab nicht registriert.`);
    }
    if (definition.requiredPermission) {
      const result = await this.checkAuthorization(definition.requiredPermission, scope);
      if (!result.allowed) {
        this.logExecution(key, 'error', input, undefined, `Autorisierung verweigert: ${result.reason}`);
        throw new Error(`Nicht autorisiert für Action "${key}": ${result.reason}`);
      }
    }
    try {
      const output = await definition.run(input);
      this.logExecution(key, 'info', input, output);
      return output;
    } catch (error) {
      this.logExecution(key, 'error', input, undefined, error);
      throw error;
    }
  }

  private async checkAuthorization(
    requiredPermission: string,
    scope?: FrontendActionAuthorizationScope,
  ): Promise<AuthorizeResult> {
    const [resourceKey, permissionKey, ...extra] = requiredPermission.split(':');
    if (!resourceKey || !permissionKey || extra.length > 0) {
      return { allowed: false, reason: 'Ungültiges requiredPermission-Format.' };
    }
    if (!scope?.tenantId.trim()) {
      return { allowed: false, reason: 'Für die Autorisierung ist eine Tenant-ID erforderlich.' };
    }

    try {
      return await firstValueFrom(
        this.apiClient
          .post<{ decision?: unknown; reason?: unknown }>(
            'security',
            '/v1/authorize',
            {
              action: permissionKey,
              resource: {
                type: resourceKey,
                attributes: {
                  tenantId: scope.tenantId,
                  ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
                  ...(scope.environmentId ? { environmentId: scope.environmentId } : {}),
                },
              },
              context: scope.environmentId ? { environment: scope.environmentId } : {},
            },
            {
              'x-tenant-id': scope.tenantId,
              ...(scope.workspaceId ? { 'x-workspace-id': scope.workspaceId } : {}),
              ...(scope.environmentId ? { 'x-environment-id': scope.environmentId } : {}),
            },
          )
          .pipe(
            map((response) => {
              const decision = response.data;
              if (decision.decision !== 'ALLOW' && decision.decision !== 'DENY') {
                return { allowed: false, reason: 'Ungültige Autorisierungsantwort.' };
              }
              return {
                allowed: decision.decision === 'ALLOW',
                reason: typeof decision.reason === 'string' ? decision.reason : 'Keine Begründung angegeben.',
              };
            }),
          ),
      );
    } catch {
      return { allowed: false, reason: 'Der Autorisierungsdienst ist nicht erreichbar.' };
    }
  }

  private logExecution(actionKey: string, level: 'info' | 'error', input: unknown, output?: unknown, error?: unknown): void {
    this.apiClient
      .post('elyvion_platform', '/logs', {
        source: 'frontend',
        level,
        message: level === 'info' ? `Action "${actionKey}" ausgeführt.` : `Action "${actionKey}" fehlgeschlagen.`,
        actionKey,
        context: {
          input: redactActionLog(input),
          output: redactActionLog(output),
          error: error instanceof Error ? error.name : error ? 'Action failed' : undefined,
        },
      })
      .subscribe({ error: () => undefined });
  }

  has(key: string): boolean {
    return this.actions.has(key);
  }

  /** Registers the handful of generic actions every Elyvion app ships with, so there's always at least one real frontend action to exercise the registry end-to-end. Called once from `AppShellComponent`, the one component mounted on every page. */
  registerBuiltins(): void {
    if (this.builtinsRegistered) return;
    this.builtinsRegistered = true;

    this.register({
      key: 'copy_to_clipboard',
      name: 'In Zwischenablage kopieren',
      description: 'Kopiert einen Text in die Zwischenablage des Browsers.',
      category: 'ui',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      run: async (input: { text: string }) => {
        await navigator.clipboard.writeText(input.text);
        return { copied: true };
      },
    });
  }
}

function redactActionLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactActionLog);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /password|secret|token|api.?key|private.?key|credential|authorization|^value$/i.test(key)
        ? '[REDACTED]'
        : redactActionLog(item),
    ]),
  );
}
