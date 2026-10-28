export const CONDITION_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export interface Condition {
  /** A field name on the record being tested — one level deep, matching how the rest of this project's constrained condition models work (e.g. workflow-engine's `ConditionStep.path`). */
  field: string;
  operator: ConditionOperator;
  /** Optional in the type only because `z.unknown()` infers that way (zod doesn't require a key typed `unknown`) — `undefined` just means "compare against undefined", evaluateCondition handles it like any other value. */
  value?: unknown;
}

/**
 * The one place every block's condition logic runs — deliberately tiny
 * and closed (no expression language, no eval) so a rule authored by a
 * business user can't do anything beyond compare one field against one
 * value, the same safety stance as the rest of this project's
 * constrained condition/filter models.
 */
export function evaluateCondition(record: Record<string, unknown>, condition: Condition): boolean {
  const actual = record[condition.field];
  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'gt':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
    case 'gte':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value;
    case 'lt':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value;
    case 'lte':
      return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
    case 'contains':
      return typeof actual === 'string' && typeof condition.value === 'string' && actual.includes(condition.value);
  }
}
