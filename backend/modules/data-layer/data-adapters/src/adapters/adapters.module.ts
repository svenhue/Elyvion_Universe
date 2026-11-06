import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdaptersController } from './adapters.controller';
import { AdaptersService } from './adapters.service';
import { ConnectorRegistry } from './connectors/connector-registry';
import { FileAdapterConnector } from './connectors/file-adapter.connector';
import { HttpAdapterConnector } from './connectors/http-adapter.connector';
import { SecretStoreClient } from './secret-store.client';
import { DataAdapterConfig, DataAdapterConfigSchema } from './schemas/data-adapter.schema';
import { DataAdapterDeployment, DataAdapterDeploymentSchema } from './schemas/data-adapter-deployment.schema';
import { DataAdapterRun, DataAdapterRunSchema } from './schemas/data-adapter-run.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DataAdapterConfig.name, schema: DataAdapterConfigSchema },
      { name: DataAdapterDeployment.name, schema: DataAdapterDeploymentSchema },
      { name: DataAdapterRun.name, schema: DataAdapterRunSchema },
    ]),
  ],
  controllers: [AdaptersController],
  providers: [AdaptersService, ConnectorRegistry, HttpAdapterConnector, FileAdapterConnector, SecretStoreClient],
})
export class AdaptersModule {}
