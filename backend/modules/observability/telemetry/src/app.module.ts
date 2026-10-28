import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'telemetry' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
