export type SolutionMemberType = 'application' | 'workflow' | 'agent' | 'knowledge_graph' | 'entity';
export const SOLUTION_MEMBER_TYPES: SolutionMemberType[] = ['application', 'workflow', 'agent', 'knowledge_graph', 'entity'];

export interface SolutionMember {
  resourceType: SolutionMemberType;
  resourceKey: string;
  label?: string;
}

export interface Solution {
  _id: string;
  key: string;
  name: string;
  description?: string;
  members: SolutionMember[];
  createdAt: string;
  updatedAt: string;
}
