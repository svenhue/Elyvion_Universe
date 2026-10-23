import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RegistryCacheService } from './registry-cache.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [RegistryCacheService],
  exports: [RegistryCacheService],
})
export class RegistryModule {}
