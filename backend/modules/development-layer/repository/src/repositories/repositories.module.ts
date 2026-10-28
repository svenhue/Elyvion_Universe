import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { Repository, RepositorySchema } from './schemas/repository.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Repository.name, schema: RepositorySchema }])],
  controllers: [RepositoriesController],
  providers: [RepositoriesService],
})
export class RepositoriesModule {}
