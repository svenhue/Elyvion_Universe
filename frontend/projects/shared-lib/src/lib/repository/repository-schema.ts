import { ResourceType } from './resource-type';

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  application: 'Anwendung',
  workflow: 'Workflow',
  agent: 'AI Agent',
  knowledge_graph: 'Wissensgraph',
  entity: 'Entität',
  action: 'Aktion',
  rule: 'Regel',
  repository: 'Repository',
  solution: 'Lösung',
};

/** The five object kinds the Kernrepository view browses — one catalog across every module that defines something copyable/bundleable. `data-adapter` has no matching `ResourceType` (Repositories/Solutions never reference it — the user never named it as something that belongs in a Repository), so it's browsable here but not addable to a Repository or Solution. */
export type RepositoryItemType = 'agent' | 'workflow' | 'entity' | 'data-adapter' | 'rule';

export const REPOSITORY_ITEM_TYPES: RepositoryItemType[] = ['agent', 'workflow', 'entity', 'data-adapter', 'rule'];

export const REPOSITORY_ITEM_TYPE_LABELS: Record<RepositoryItemType, string> = {
  agent: 'AI Agent',
  workflow: 'Workflow',
  entity: 'Entität',
  'data-adapter': 'Data-Adapter',
  rule: 'Regel',
};

/** Maps a Kernrepository row's item type onto the `ResourceType` to use when adding it to a Solution or Repository — `undefined` means "not supported" (currently just `data-adapter`). */
export const REPOSITORY_TO_RESOURCE_TYPE: Partial<Record<RepositoryItemType, ResourceType>> = {
  agent: 'agent',
  workflow: 'workflow',
  entity: 'entity',
  rule: 'rule',
};

/** Which item types this hub knows how to physically duplicate into a new Repository — "vom Kernrepository eine Workflow-Definition auf ein neues Repository kopieren." `agent` has only one global prompt per key (nothing to duplicate into a second instance), so it's excluded despite having a `ResourceType`. */
export const COPYABLE_ITEM_TYPES: RepositoryItemType[] = ['workflow', 'entity', 'rule'];

export interface RepositoryItem {
  type: RepositoryItemType;
  key: string;
  name: string;
  detail?: string;
  /** Route to the owning module's own page, for "go look at/edit this". */
  link: string;
}

export interface RepositoryMemberOrigin {
  resourceType: ResourceType;
  resourceKey: string;
}

export interface RepositoryMemberRef {
  resourceType: ResourceType;
  resourceKey: string;
  label?: string;
  /** Set when this member is a copy of another resource rather than authored here directly. */
  copiedFrom?: RepositoryMemberOrigin;
}

/** A user-created, Mongo-backed Repository — a curated subset, distinct from the implicit, computed "Kernrepository" (everything that exists, by default). */
export interface RepositoryRecord {
  _id: string;
  key: string;
  name: string;
  description?: string;
  members: RepositoryMemberRef[];
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryCopyRef {
  repositoryKey: string;
  repositoryName: string;
  resourceType: ResourceType;
  resourceKey: string;
}
