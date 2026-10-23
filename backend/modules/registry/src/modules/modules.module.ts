import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthCheckService } from '../health/health-check.service';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ModulesController],
  providers: [ModulesService, HealthCheckService],
})
export class ModulesModule {}
