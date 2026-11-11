import * as bcrypt from 'bcryptjs';
import { RoleResolverService } from '../authorization/role-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AccountsService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tenantMembership: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    tenant: { findUnique: jest.Mock; findMany: jest.Mock };
    roleAssignment: { deleteMany: jest.Mock };
    objectPermission: { deleteMany: jest.Mock };
    workspaceMembership: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let roles: { hasSuperAdminRole: jest.Mock };
  let service: AccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenantMembership: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      tenant: { findUnique: jest.fn(), findMany: jest.fn() },
      roleAssignment: { deleteMany: jest.fn() },
      objectPermission: { deleteMany: jest.fn() },
      workspaceMembership: { deleteMany: jest.fn() },
      $transaction: jest.fn(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma)),
    };
    roles = { hasSuperAdminRole: jest.fn().mockResolvedValue(false) };
    service = new AccountsService(
      prisma as unknown as PrismaService,
      roles as unknown as RoleResolverService,
    );
  });

  it('stores a hash and returns account metadata only', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('password-hash');
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-id',
      email: 'admin@example.test',
      name: 'Admin',
      passwordHash: 'password-hash',
    });

    const user = await service.register({
      email: ' Admin@Example.Test ',
      password: 'passphrase',
      name: 'Admin',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('passphrase', 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'admin@example.test',
        passwordHash: 'password-hash',
        name: 'Admin',
      },
    });
    expect(user).toEqual({ id: 'user-id', email: 'admin@example.test', name: 'Admin' });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('checks credentials using a normalized email without returning the password hash', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'admin@example.test',
      name: null,
      passwordHash: 'password-hash',
    });

    const user = await service.verifyCredentials({
      email: 'ADMIN@example.test',
      password: 'passphrase',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.test' },
    });
    expect(user).toEqual({ id: 'user-id', email: 'admin@example.test', name: null });
  });

  it('fails closed when the tenant membership is missing', async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    await expect(service.hasActiveMembership('user-id', 'tenant-id')).resolves.toBe(false);
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        tenantId: 'tenant-id',
        status: 'active',
        tenant: { status: 'active' },
      },
      select: { id: true },
    });
  });

  it('lists every tenant for a platform super-admin', async () => {
    const tenants = [{ id: 'tenant-a', name: 'A' }, { id: 'tenant-b', name: 'B' }];
    roles.hasSuperAdminRole.mockResolvedValue(true);
    prisma.tenant.findMany.mockResolvedValue(tenants);

    await expect(service.listActiveTenants('user-id')).resolves.toEqual(tenants);

    expect(roles.hasSuperAdminRole).toHaveBeenCalledWith('user-id', 'user');
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(prisma.tenantMembership.findMany).not.toHaveBeenCalled();
  });

  it('lists only active tenant memberships for a regular user', async () => {
    prisma.tenantMembership.findMany.mockResolvedValue([
      { tenantId: 'tenant-a', tenant: { name: 'A' } },
    ]);

    await expect(service.listActiveTenants('user-id')).resolves.toEqual([
      { id: 'tenant-a', name: 'A' },
    ]);

    expect(prisma.tenant.findMany).not.toHaveBeenCalled();
  });

  it('removes user-linked authorization and workspace records before deleting an account', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id' });

    await service.remove('user-id');

    expect(prisma.roleAssignment.deleteMany).toHaveBeenCalledWith({
      where: { subjectId: 'user-id', subjectType: 'user' },
    });
    expect(prisma.objectPermission.deleteMany).toHaveBeenCalledWith({
      where: { subjectId: 'user-id', subjectType: 'user' },
    });
    expect(prisma.workspaceMembership.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-id' } });
  });
});
