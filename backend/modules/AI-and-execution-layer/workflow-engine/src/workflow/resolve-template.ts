/**
 * Resolves a step's input values against the run's context. Three shapes:
 * - `"$context.some.path"` — reads from the run's accumulated context.
 * - a plain value — used as-is.
 * - an object/array — walked recursively, resolving any `$context....`
 *   strings found inside (so a request body can mix literals and
 *   context-sourced fields).
 */
export function resolveTemplate(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const match = /^\$context\.(.+)$/.exec(value);
    return match ? readPath(context, match[1]) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplate(item, context));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, resolveTemplate(nested, context)]),
    );
  }
  return value;
}

export function readPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}
