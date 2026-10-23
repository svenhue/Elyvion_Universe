import { Injectable, Logger } from '@nestjs/common';
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
}
