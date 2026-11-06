import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { PrismaModule } from './prisma/prisma.module';
import { TrafficModule } from './traffic/traffic.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'traffic' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TrafficModule,
  ],
})
export class AppModule {}
