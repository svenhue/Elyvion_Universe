import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns role-hierarchy traversal — the one thing both "does this subject
 * have permission X" and "would adding this inheritance edge create a
 * cycle" need: the set of a role's ancestors (every role it directly or
 * transitively inherits from).
 */
@Injectable()
export class RoleResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every role a subject effectively has: its direct assignments plus each of their ancestors. */
  async effectiveRoleIds(subjectId: string, subjectType: 'user' | 'agent'): Promise<string[]> {
    const assignments = await this.prisma.roleAssignment.findMany({ where: { subjectId, subjectType } });
    const result = new Set(assignments.map((a) => a.roleId));
    for (const roleId of assignments.map((a) => a.roleId)) {
      for (const ancestor of await this.ancestorsOf(roleId)) result.add(ancestor);
    }
    return [...result];
  }

  /** BFS over `RoleInheritance` edges, child → parent, visited-guarded so a pre-existing cycle (shouldn't happen, but data can always be wrong) can't loop forever. */
  async ancestorsOf(roleId: string): Promise<string[]> {
    const visited = new Set<string>();
    const queue = [roleId];
    while (queue.length) {
      const current = queue.shift()!;
      const parents = await this.prisma.roleInheritance.findMany({ where: { childRoleId: current } });
      for (const { parentRoleId } of parents) {
        if (!visited.has(parentRoleId)) {
          visited.add(parentRoleId);
          queue.push(parentRoleId);
        }
      }
    }
    return [...visited];
  }

  /** Adding childRoleId→parentRoleId is only safe if parentRoleId doesn't already (transitively) inherit from childRoleId. */
  async assertNoCycle(childRoleId: string, parentRoleId: string): Promise<void> {
    if (childRoleId === parentRoleId) {
      throw new ConflictException('Eine Rolle kann nicht von sich selbst erben.');
    }
    const parentAncestors = await this.ancestorsOf(parentRoleId);
    if (parentAncestors.includes(childRoleId)) {
      throw new ConflictException('Diese Vererbung würde einen Zyklus in der Rollen-Hierarchie erzeugen.');
    }
  }
}
