import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationRequest, AuthorizationService } from './authorization.service';
import { RoleResolverService } from './role-resolver.service';

describe('AuthorizationService', () => {
  let prisma: {
    auditLog: { create: jest.Mock };
    resource: { findUnique: jest.Mock };
    permission: { findUnique: jest.Mock };
    objectPermission: { findUnique: jest.Mock };
    rolePermission: { findFirst: jest.Mock };
    workspaceMembership: { findFirst: jest.Mock };
    tenantMembership: { findFirst: jest.Mock };
  };
  let roles: { effectiveRoleIds: jest.Mock };
  let service: AuthorizationService;

  beforeEach(() => {
    prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      resource: { findUnique: jest.fn().mockResolvedValue({ id: 'resource-id' }) },
      permission: { findUnique: jest.fn().mockResolvedValue({ id: 'permission-id' }) },
      objectPermission: { findUnique: jest.fn().mockResolvedValue(null) },
      rolePermission: { findFirst: jest.fn().mockResolvedValue(null) },
      workspaceMembership: { findFirst: jest.fn().mockResolvedValue(null) },
      tenantMembership: { findFirst: jest.fn().mockResolvedValue({ id: 'membership-id' }) },
    };
    roles = { effectiveRoleIds: jest.fn().mockResolvedValue([]) };
    service = new AuthorizationService(
      prisma as unknown as PrismaService,
      roles as unknown as RoleResolverService,
    );
  });

  it('denies access without an active tenant membership and audits the denial', async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    const decision = await service.authorize(makeRequest());

    expect(decision.decision).toBe('DENY');
    expect(decision.evaluatedPermissions).toEqual(['data.record.read']);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: 'DENY', tenantId: 'tenant-a' }),
      }),
    );
    expect(roles.effectiveRoleIds).not.toHaveBeenCalled();
  });

  it('denies a resource whose tenant does not match the verified membership', async () => {
    const decision = await service.authorize(makeRequest({
      resource: { type: 'data-engine', id: 'record-1', attributes: { tenantId: 'tenant-b' } },
    }));

    expect(decision.decision).toBe('DENY');
    expect(decision.reason).toContain('different tenant');
    expect(roles.effectiveRoleIds).not.toHaveBeenCalled();
  });

  it('uses the active tenant role and returns validated obligations', async () => {
    roles.effectiveRoleIds.mockResolvedValue(['tenant-role-id']);
    prisma.rolePermission.findFirst.mockResolvedValue({
      role: { key: 'developer' },
      obligations: { maskColumns: ['email'], maxRows: 100 },
    } as never);

    const decision = await service.authorize(makeRequest());

    expect(decision.decision).toBe('ALLOW');
    expect(decision.matchedPolicies).toEqual(['role:developer']);
    expect(decision.obligations).toEqual({ maskColumns: ['email'], maxRows: 100 });
    expect(roles.effectiveRoleIds).toHaveBeenCalledWith('user-1', 'user', 'tenant-a');
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        tenantId: 'tenant-a',
        status: 'active',
        tenant: { status: 'active' },
      },
      select: { id: true },
    });
  });

  it('does not return an allow decision when the required audit write fails', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('audit database unavailable'));

    await expect(service.authorize(makeRequest())).rejects.toThrow('audit database unavailable');
  });

  it('denies a user without active membership in the requested workspace', async () => {
    const decision = await service.authorize(makeRequest({
      resource: {
        type: 'data-adapters',
        attributes: { workspaceId: 'workspace-b', tenantId: 'tenant-a' },
      },
    }));

    expect(decision.decision).toBe('DENY');
    expect(decision.reason).toContain('workspace');
    expect(prisma.workspaceMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        workspaceId: 'workspace-b',
        status: 'active',
        workspace: { tenantId: 'tenant-a' },
      },
      select: { id: true },
    });
  });
});

function makeRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    userId: 'user-1',
    tenantId: 'tenant-a',
    action: 'data.record.read',
    resource: { type: 'data-engine', id: 'record-1', attributes: {} },
    context: { requestId: 'request-1' },
    ...overrides,
  };
}
