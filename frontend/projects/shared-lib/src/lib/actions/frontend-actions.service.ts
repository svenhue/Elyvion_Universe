import { Injectable, inject } from '@angular/core';
import { ActionsApiService } from './actions-api.service';

export interface FrontendActionDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: Record<string, unknown>;
  run(input: TInput): Promise<TOutput> | TOutput;
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
      })
      .subscribe({
        error: (error: unknown) =>
          console.error(`[FrontendActionsService] Registrierung von "${definition.key}" fehlgeschlagen:`, error),
      });
  }

  async execute(key: string, input: Record<string, unknown> = {}): Promise<unknown> {
    const definition = this.actions.get(key);
    if (!definition) {
      throw new Error(`Frontend-Action "${key}" ist in diesem Tab nicht registriert.`);
    }
    return definition.run(input);
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
