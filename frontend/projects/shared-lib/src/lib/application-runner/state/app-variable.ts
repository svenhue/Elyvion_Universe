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
