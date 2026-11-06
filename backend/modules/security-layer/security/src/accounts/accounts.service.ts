import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto, UpdateUserDto, VerifyCredentialsDto } from './dto/accounts.dto';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterUserDto): Promise<SafeUser> {
    const email = normalizeEmail(dto.email);
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('This email address is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash, name: dto.name },
      });
      return toSafeUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This email address is already registered.');
      }
      throw error;
    }
  }

  async verifyCredentials(dto: VerifyCredentialsDto): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return toSafeUser(user);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User "${id}" not found.`);
    return toSafeUser(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { email: 'asc' } });
    return users.map(toSafeUser);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.findById(id);
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { ...dto, ...(dto.email ? { email: normalizeEmail(dto.email) } : {}) },
      });
      return toSafeUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('This email address is already registered.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.roleAssignment.deleteMany({ where: { subjectId: id, subjectType: 'user' } });
      await transaction.objectPermission.deleteMany({ where: { subjectId: id, subjectType: 'user' } });
      await transaction.workspaceMembership.deleteMany({ where: { userId: id } });
      await transaction.user.delete({ where: { id } });
    });
  }

  async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    return !!(await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        status: 'active',
        tenant: { status: 'active' },
      },
      select: { id: true },
    }));
  }

  async listActiveTenants(userId: string) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: {
        userId,
        status: 'active',
        tenant: { status: 'active' },
      },
      select: {
        tenantId: true,
        tenant: { select: { name: true } },
      },
      orderBy: { tenant: { name: 'asc' } },
    });
    return memberships.map(({ tenantId, tenant }) => ({ id: tenantId, name: tenant.name }));
  }

  async bootstrapTenant(name: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User "${email}" not found.`);

    return this.prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: { name } });
      await transaction.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, status: 'active' },
      });
      return { tenantId: tenant.id, userId: user.id, tenantName: tenant.name };
    });
  }

  async addTenantMember(tenantId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User "${email}" not found.`);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status !== 'active') {
      throw new NotFoundException(`Active tenant "${tenantId}" not found.`);
    }

    return this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, status: 'active' },
      update: { status: 'active' },
      select: { id: true, tenantId: true, userId: true, status: true },
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSafeUser(user: { id: string; email: string; name: string | null }): SafeUser {
  return { id: user.id, email: user.email, name: user.name };
}

function isUniqueConstraintError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
}
