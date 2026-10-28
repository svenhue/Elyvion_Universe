import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { ActionsModule } from './actions/actions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'actions-engine' }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_actions'),
    ActionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
