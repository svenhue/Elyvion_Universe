import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { recordVersion } from '@elyvion/shared';
import { AddMemberDto, CreateRepositoryDto } from './dto/repositories.dto';
import { Repository, RepositoryDocument } from './schemas/repository.schema';

const VERSION_CONTROL_URL = process.env.VERSION_CONTROL_URL ?? 'http://localhost:3026';

@Injectable()
export class RepositoriesService {
  constructor(@InjectModel(Repository.name) private readonly model: Model<RepositoryDocument>) {}

  async create(dto: CreateRepositoryDto) {
    const existing = await this.model.findOne({ key: dto.key }).lean();
    if (existing) throw new ConflictException(`Repository "${dto.key}" existiert bereits.`);
    const doc = await this.model.create({ ...dto, members: [] });
    return doc.toObject();
  }

  list() {
    return this.model.find().sort({ name: 1 }).lean();
  }

  async findOne(key: string) {
    const doc = await this.model.findOne({ key }).lean();
    if (!doc) throw new NotFoundException(`Repository "${key}" wurde nicht gefunden.`);
    return doc;
  }

  async remove(key: string): Promise<void> {
    await this.findOne(key);
    await this.model.deleteOne({ key });
  }

  async addMember(key: string, dto: AddMemberDto) {
    const repository = await this.findOne(key);
    const alreadyMember = repository.members.some(
      (m) => m.resourceType === dto.resourceType && m.resourceKey === dto.resourceKey,
    );
    if (alreadyMember) return repository;
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'repository',
      resourceKey: key,
      snapshot: repository,
    });
    return this.model.findOneAndUpdate({ key }, { $push: { members: dto } }, { new: true }).lean();
  }

  async removeMember(key: string, resourceType: string, resourceKey: string) {
    const before = await this.findOne(key);
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'repository',
      resourceKey: key,
      snapshot: before,
    });
    const doc = await this.model
      .findOneAndUpdate({ key }, { $pull: { members: { resourceType, resourceKey } } }, { new: true })
      .lean();
    return doc!;
  }

  /**
   * Every repository (and the member within it) that is a *copy* of the
   * given original — what a module's edit UI calls right after a
   * successful update, to ask "diese Kopien auch aktualisieren?" instead
   * of silently letting them drift.
   */
  async copiesOf(resourceType: string, resourceKey: string) {
    const repositories = await this.model
      .find({ 'members.copiedFrom.resourceType': resourceType, 'members.copiedFrom.resourceKey': resourceKey })
      .lean();
    return repositories.flatMap((repo) =>
      repo.members
        .filter((m) => m.copiedFrom?.resourceType === resourceType && m.copiedFrom?.resourceKey === resourceKey)
        .map((m) => ({ repositoryKey: repo.key, repositoryName: repo.name, resourceType: m.resourceType, resourceKey: m.resourceKey })),
    );
  }
}
