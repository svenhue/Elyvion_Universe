import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto, VerifyCredentialsDto } from './dto/users.dto';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
    });

    return this.toSafeUser(user);
  }

  async verifyCredentials(dto: VerifyCredentialsDto): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.toSafeUser(user);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    return this.toSafeUser(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { email: 'asc' },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async update(id: string, dto: { email?: string; name?: string }): Promise<SafeUser> {
    await this.findById(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return this.toSafeUser(user);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        userId,
        tenantId,
        status: 'active',
        tenant: { status: 'active' },
      },
      select: { id: true },
    });
    return membership !== null;
  }

  async bootstrapTenant(name: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`User "${email}" not found`);

    return this.prisma.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({ data: { name } });
      await transaction.tenantMembership.create({
        data: { tenantId: tenant.id, userId: user.id, status: 'active' },
      });
      return { tenantId: tenant.id, userId: user.id, tenantName: tenant.name };
    });
  }

  async addTenantMember(tenantId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException(`User "${email}" not found`);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status !== 'active') throw new NotFoundException(`Active tenant "${tenantId}" not found`);

    return this.prisma.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, status: 'active' },
      update: { status: 'active' },
      select: { id: true, tenantId: true, userId: true, status: true },
    });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string | null;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
