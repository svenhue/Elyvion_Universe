import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto, VerifyCredentialsDto } from './dto/users.dto';

const DEFAULT_ROLE = 'user';

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
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
    const role = await this.prisma.role.upsert({
      where: { name: DEFAULT_ROLE },
      create: { name: DEFAULT_ROLE },
      update: {},
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        roles: { create: [{ roleId: role.id }] },
      },
      include: { roles: { include: { role: true } } },
    });

    return this.toSafeUser(user);
  }

  async verifyCredentials(dto: VerifyCredentialsDto): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roles: { include: { role: true } } },
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
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException(`User "${id}" not found`);
    }
    return this.toSafeUser(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { email: 'asc' },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async update(id: string, dto: { email?: string; name?: string }): Promise<SafeUser> {
    await this.findById(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: { roles: { include: { role: true } } },
    });
    return this.toSafeUser(user);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string | null;
    roles: { role: { name: string } }[];
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((r) => r.role.name),
    };
  }
}
