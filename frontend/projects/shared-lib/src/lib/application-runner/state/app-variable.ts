export type AppVariableType = 'string' | 'number' | 'boolean' | 'json' | 'list' | 'theme';

export interface AppVariable<T = unknown> {
  name: string;
  type: AppVariableType;
  value: T;
}

/** `$variableName` → `'variableName'`, or `null` if the string isn't a variable reference. */
export function parseVariableReference(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('$') || value.length < 2) {
    return null;
  }
  return value.slice(1);
}

/**
 * The default theme token variables every application starts with —
 * seeded by `AppStateService` so `$primary`, `$accent`, etc. are always
 * there to bind against, with no setup. Each is its own `'theme'`-typed
 * variable holding a single color, not one variable holding all of them,
 * so a style like `{ "color": "$accent" }` can reference one directly.
 */
export const DEFAULT_THEME_VARIABLES: ReadonlyArray<{ name: string; value: string }> = [
  { name: 'primary', value: '#4f46e5' },
  { name: 'secondary', value: '#64748b' },
  { name: 'background', value: '#ffffff' },
  { name: 'surface', value: '#f8fafc' },
  { name: 'text', value: '#0f172a' },
  { name: 'accent', value: '#3b82f6' },
  { name: 'danger', value: '#dc2626' },
];
