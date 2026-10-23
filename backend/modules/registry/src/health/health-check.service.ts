import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModuleStatus } from '../../generated/prisma';
import axios from 'axios';
import { ModulesService } from '../modules/modules.service';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(private readonly modulesService: ModulesService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pingAllModules() {
    const modules = await this.modulesService.findAll();

    await Promise.all(
      modules.map(async (module) => {
        try {
          await axios.get(module.healthCheckUrl, { timeout: 3000 });
          await this.modulesService.setStatus(module.id, ModuleStatus.healthy);
        } catch {
          await this.modulesService.setStatus(module.id, ModuleStatus.unhealthy);
          this.logger.warn(`Module "${module.name}" failed health check`);
        }
      }),
    );
  }
}
