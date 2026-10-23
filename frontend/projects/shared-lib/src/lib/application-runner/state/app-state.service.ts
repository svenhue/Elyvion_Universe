import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import { AppVariable, AppVariableType, DEFAULT_THEME_VARIABLES } from './app-variable';

/**
 * The application's global variable store — the "import a REST dataset as
 * a list, several components read and edit it" container, plus simpler
 * named values (strings, numbers, theme tokens, ...) that any component's
 * `attributes` can reference as `"$variableName"` (see `parseVariableReference`
 * and `DynamicRendererComponent`, which resolves these reactively).
 *
 * One signal per variable (not one signal holding the whole variable map):
 * changing a single large `list` variable only notifies the components
 * that actually read *that* variable, not every consumer of every other
 * variable — the standard fine-grained-reactivity shape for this kind of
 * store, and the only one that stays cheap once a variable holds a sizeable
 * dataset.
 */
@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly variables = new Map<string, WritableSignal<AppVariable>>();
  private readonly namesSignal = signal<string[]>([]);

  constructor() {
    for (const theme of DEFAULT_THEME_VARIABLES) {
      this.setVariable(theme.name, 'theme', theme.value);
    }
  }

  /** Variable names, for the sidebar list and the `$`-autocomplete. */
  readonly variableNames: Signal<string[]> = this.namesSignal.asReadonly();

  /** All variables, for the sidebar list (not for hot render-path reads — use `variableSignal()` there). */
  readonly variables$ = computed(() =>
    this.namesSignal()
      .map((name) => this.variables.get(name)?.())
      .filter((variable): variable is AppVariable => variable !== undefined),
  );

  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  getVariable(name: string): AppVariable | undefined {
    return this.variables.get(name)?.();
  }

  /** Reactive read of one variable's value — the one to use from render/binding code. */
  variableSignal<T = unknown>(name: string): Signal<T | undefined> {
    return computed(() => this.variables.get(name)?.().value as T | undefined);
  }

  setVariable<T = unknown>(name: string, type: AppVariableType, value: T): void {
    const key = name.trim();
    if (!key) {
      throw new Error('A variable name is required.');
    }

    const existing = this.variables.get(key);
    if (existing) {
      existing.set({ name: key, type, value });
      return;
    }

    this.variables.set(key, signal<AppVariable>({ name: key, type, value }));
    this.namesSignal.update((names) => [...names, key].sort((a, b) => a.localeCompare(b)));
  }

  removeVariable(name: string): void {
    if (!this.variables.delete(name)) {
      return;
    }
    this.namesSignal.update((names) => names.filter((existing) => existing !== name));
  }
}
