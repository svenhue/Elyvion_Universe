import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigsController } from './app-configs.controller';
import { AppConfigsService } from './app-configs.service';
import { AppConfig, AppConfigSchema } from './schemas/app-config.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AppConfig.name, schema: AppConfigSchema }])],
  controllers: [AppConfigsController],
  providers: [AppConfigsService],
})
export class AppConfigsModule {}
