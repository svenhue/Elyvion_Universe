import { ResourceType } from './resource-type';
import { Solution } from '../solutions/solutions-schema';

export interface SolutionGroup<T> {
  solution: Solution;
  items: T[];
}

/**
 * "Alle Apps aufgelistet, gruppiert nach, in welchen Lösungen die liegen,
 * plus alle, die im Kernrepository noch gar nicht deployed sind" — one
 * item can land under more than one Solution's heading if several
 * Solutions reference it; `ungrouped` is whatever no Solution references
 * at all yet.
 */
export function groupBySolution<T>(
  items: T[],
  keyOf: (item: T) => string,
  resourceType: ResourceType,
  solutions: Solution[],
): { groups: SolutionGroup<T>[]; ungrouped: T[] } {
  const groups = solutions
    .map((solution) => ({
      solution,
      items: items.filter((item) => solution.members.some((m) => m.resourceType === resourceType && m.resourceKey === keyOf(item))),
    }))
    .filter((group) => group.items.length > 0);

  const groupedKeys = new Set(groups.flatMap((group) => group.items.map(keyOf)));
  const ungrouped = items.filter((item) => !groupedKeys.has(keyOf(item)));
  return { groups, ungrouped };
}
