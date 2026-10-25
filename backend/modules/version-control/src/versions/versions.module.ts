import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ObjectVersion, ObjectVersionSchema } from './schemas/object-version.schema';
import { VersionsController } from './versions.controller';
import { VersionsService } from './versions.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ObjectVersion.name, schema: ObjectVersionSchema }])],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}
