import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdaptersController } from './adapters.controller';
import { AdaptersService } from './adapters.service';
import { ConnectorRegistry } from './connectors/connector-registry';
import { FileAdapterConnector } from './connectors/file-adapter.connector';
import { HttpAdapterConnector } from './connectors/http-adapter.connector';
import { DataAdapterConfig, DataAdapterConfigSchema } from './schemas/data-adapter.schema';
import { DataAdapterRun, DataAdapterRunSchema } from './schemas/data-adapter-run.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DataAdapterConfig.name, schema: DataAdapterConfigSchema },
      { name: DataAdapterRun.name, schema: DataAdapterRunSchema },
    ]),
  ],
  controllers: [AdaptersController],
  providers: [AdaptersService, ConnectorRegistry, HttpAdapterConnector, FileAdapterConnector],
})
export class AdaptersModule {}
