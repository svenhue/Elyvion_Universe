import * as bcrypt from 'bcryptjs';
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
    tenant: { findUnique: jest.Mock };
    roleAssignment: { deleteMany: jest.Mock };
    objectPermission: { deleteMany: jest.Mock };
    workspaceMembership: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
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
      tenant: { findUnique: jest.fn() },
      roleAssignment: { deleteMany: jest.fn() },
      objectPermission: { deleteMany: jest.fn() },
      workspaceMembership: { deleteMany: jest.fn() },
      $transaction: jest.fn(async (callback: (transaction: typeof prisma) => unknown) => callback(prisma)),
    };
    service = new AccountsService(prisma as unknown as PrismaService);
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
