import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ElyvionLoggerModule } from '@elyvion/shared';
import { LlmConfigurationController } from './configuration/llm-configuration.controller';
import { LlmConfiguration, LlmConfigurationSchema } from './configuration/llm-configuration.schema';
import { LlmConfigurationService } from './configuration/llm-configuration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElyvionLoggerModule.forRoot({ moduleName: process.env.MODULE_NAME ?? 'local-llm' }),
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/elyvion_local_llm'),
    MongooseModule.forFeature([{ name: LlmConfiguration.name, schema: LlmConfigurationSchema }]),
  ],
  controllers: [LlmConfigurationController],
  providers: [LlmConfigurationService],
})
export class AppModule {}
