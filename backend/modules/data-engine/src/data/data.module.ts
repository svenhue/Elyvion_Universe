import { Module } from '@nestjs/common';
import { EntitiesModule } from '../entities/entities.module';
import { DataController } from './data.controller';
import { DataService } from './data.service';

@Module({
  imports: [EntitiesModule],
  controllers: [DataController],
  providers: [DataService],
})
export class DataModule {}
