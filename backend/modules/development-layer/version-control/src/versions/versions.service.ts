import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecordVersionDto } from './dto/versions.dto';
import { ObjectVersion, ObjectVersionDocument } from './schemas/object-version.schema';

@Injectable()
export class VersionsService {
  constructor(@InjectModel(ObjectVersion.name) private readonly model: Model<ObjectVersionDocument>) {}

  /** Appends the next version for (resourceType, resourceKey) — never overwrites, so history is always complete. */
  async record(dto: RecordVersionDto) {
    const latest = await this.model.findOne({ resourceType: dto.resourceType, resourceKey: dto.resourceKey }).sort({ version: -1 }).lean();
    const nextVersion = (latest?.version ?? 0) + 1;
    const doc = await this.model.create({ ...dto, version: nextVersion });
    return doc.toObject();
  }

  history(resourceType: string, resourceKey: string) {
    return this.model.find({ resourceType, resourceKey }).sort({ version: -1 }).lean();
  }

  async latest(resourceType: string, resourceKey: string) {
    const doc = await this.model.findOne({ resourceType, resourceKey }).sort({ version: -1 }).lean();
    if (!doc) throw new NotFoundException(`Keine Version für "${resourceType}:${resourceKey}" gefunden.`);
    return doc;
  }

  async getVersion(resourceType: string, resourceKey: string, version: number) {
    const doc = await this.model.findOne({ resourceType, resourceKey, version }).lean();
    if (!doc) throw new NotFoundException(`Version ${version} von "${resourceType}:${resourceKey}" wurde nicht gefunden.`);
    return doc;
  }
}
