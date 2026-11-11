import { PrismaService } from '../prisma/prisma.service';
import { RoleResolverService } from './role-resolver.service';

describe('RoleResolverService', () => {
  const prisma = {
    roleAssignment: { findMany: jest.fn() },
    roleInheritance: { findMany: jest.fn() },
    role: { findFirst: jest.fn() },
  };
  let service: RoleResolverService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.roleAssignment.findMany.mockResolvedValue([{ roleId: 'admin-role-id' }]);
    prisma.roleInheritance.findMany.mockResolvedValue([]);
    prisma.role.findFirst.mockResolvedValue({ id: 'admin-role-id' });
    service = new RoleResolverService(prisma as unknown as PrismaService);
  });

  it('recognizes the super-admin attribute among the subject roles across tenants', async () => {
    await expect(service.hasSuperAdminRole('user-id', 'user')).resolves.toBe(true);

    expect(prisma.roleAssignment.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'user-id',
        subjectType: 'user',
        tenantId: { not: 'unscoped' },
      },
    });
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { id: { in: ['admin-role-id'] }, isSuperAdmin: true },
      select: { id: true },
    });
  });

  it('does not query for a privileged role when the subject has no tenant role', async () => {
    prisma.roleAssignment.findMany.mockResolvedValue([]);

    await expect(service.hasSuperAdminRole('user-id', 'user')).resolves.toBe(false);

    expect(prisma.role.findFirst).not.toHaveBeenCalled();
  });
});
