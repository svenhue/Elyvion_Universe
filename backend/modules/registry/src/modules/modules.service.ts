import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterModuleDto } from './register-module.dto';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterModuleDto) {
    const module = await this.prisma.module.upsert({
      where: { name: dto.name },
      create: { ...dto, status: ModuleStatus.unknown },
      update: { ...dto, lastSeenAt: new Date() },
    });
    this.logger.log(`Module "${module.name}" (${module.type}) registered at ${module.baseUrl}`);
    return module;
  }

  findAll() {
    return this.prisma.module.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(name: string) {
    return this.prisma.module.findUnique({ where: { name } });
  }

  async setStatus(id: string, status: ModuleStatus) {
    return this.prisma.module.update({
      where: { id },
      data: { status, lastSeenAt: new Date() },
    });
  }

  async update(name: string, dto: Partial<RegisterModuleDto>) {
    const existing = await this.prisma.module.findUnique({ where: { name } });
    if (!existing) {
      throw new NotFoundException(`Module "${name}" not found`);
    }
    return this.prisma.module.update({ where: { name }, data: dto });
  }

  async remove(name: string) {
    const existing = await this.prisma.module.findUnique({ where: { name } });
    if (!existing) {
      throw new NotFoundException(`Module "${name}" not found`);
    }
    await this.prisma.module.delete({ where: { name } });
  }
}
