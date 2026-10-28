import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ProviderRegistry } from './providers/provider-registry';
import { Integration, IntegrationSchema } from './schemas/integration.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }])],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ProviderRegistry],
})
export class IntegrationsModule {}
