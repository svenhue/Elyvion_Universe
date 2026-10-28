import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AdaptersModule } from './adapters/adapters.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'data-adapters' }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_data_adapters'),
    AdaptersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
