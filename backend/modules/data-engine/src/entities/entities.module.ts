import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EntitiesController } from './entities.controller';
import { EntityRegistryService } from './entity-registry.service';
import { EntityDefinition, EntityDefinitionSchema } from './schemas/entity-definition.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: EntityDefinition.name, schema: EntityDefinitionSchema }])],
  controllers: [EntitiesController],
  providers: [EntityRegistryService],
  exports: [EntityRegistryService],
})
export class EntitiesModule {}
