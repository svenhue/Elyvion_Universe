import { SolutionMemberType } from '../solutions/solutions-schema';

/** The five object kinds the Kernrepository aggregates — "wo wir alle diese Objekte erstellen", one catalog across every module that defines something a Solution can later bundle. */
export type RepositoryItemType = 'agent' | 'workflow' | 'entity' | 'data-adapter' | 'rule';

export const REPOSITORY_ITEM_TYPES: RepositoryItemType[] = ['agent', 'workflow', 'entity', 'data-adapter', 'rule'];

export const REPOSITORY_ITEM_TYPE_LABELS: Record<RepositoryItemType, string> = {
  agent: 'AI Agent',
  workflow: 'Workflow',
  entity: 'Entität',
  'data-adapter': 'Data-Adapter',
  rule: 'Regel',
};

/**
 * Only `agent` / `workflow` / `entity` have a matching `SolutionMemberType` —
 * `knowledge_graph` and `application` aren't produced by this hub, and
 * `data-adapter` / `rule` were never part of Solutions' own member-type
 * union (a rule is referenced *from* a workflow, not deployed on its own).
 */
export const REPOSITORY_TO_SOLUTION_MEMBER_TYPE: Partial<Record<RepositoryItemType, SolutionMemberType>> = {
  agent: 'agent',
  workflow: 'workflow',
  entity: 'entity',
};

export interface RepositoryItem {
  type: RepositoryItemType;
  key: string;
  name: string;
  detail?: string;
  /** Route to the owning module's own page, for "go look at/edit this". */
  link: string;
}
