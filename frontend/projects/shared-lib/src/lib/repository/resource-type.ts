/**
 * Every object type the platform manages — shared by Solutions' `SolutionMember`
 * and Repository's `RepositoryMember`, which both just reference one of these by
 * `resourceType` + `resourceKey`. Named "ResourceType" rather than bare "Resource"
 * since `security` already uses "Resource" for a backend module acting as a
 * permission boundary — a different concept (see solutions/README.md).
 */
export type ResourceType =
  | 'application'
  | 'workflow'
  | 'agent'
  | 'knowledge_graph'
  | 'entity'
  | 'action'
  | 'rule'
  | 'repository'
  | 'solution';

export const RESOURCE_TYPES: ResourceType[] = [
  'application',
  'workflow',
  'agent',
  'knowledge_graph',
  'entity',
  'action',
  'rule',
  'repository',
  'solution',
];
