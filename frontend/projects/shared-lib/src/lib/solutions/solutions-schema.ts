import { RESOURCE_TYPES, ResourceType } from '../repository/resource-type';

export type SolutionMemberType = ResourceType;
export const SOLUTION_MEMBER_TYPES: SolutionMemberType[] = RESOURCE_TYPES;

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
  /** Set when this Solution is the deploy-snapshot of a `repository` module Repository. */
  sourceRepositoryKey?: string;
  members: SolutionMember[];
  createdAt: string;
  updatedAt: string;
}
