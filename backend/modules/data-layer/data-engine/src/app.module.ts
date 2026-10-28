import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { AppController } from './app.controller';
import { DataModule } from './data/data.module';
import { EntitiesModule } from './entities/entities.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'data-engine' }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_data_engine'),
    EntitiesModule,
    DataModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
