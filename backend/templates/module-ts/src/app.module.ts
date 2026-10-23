import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { ExampleCronService } from './jobs/example-cron.service';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'module-ts-template' }),
    ScheduleModule.forRoot(),
    TasksModule,
  ],
  controllers: [AppController],
  providers: [ExampleCronService],
})
export class AppModule {}
