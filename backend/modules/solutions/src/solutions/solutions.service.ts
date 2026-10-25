import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { recordVersion } from '@elyvion/shared';
import { AddMemberDto, CreateSolutionDto } from './dto/solutions.dto';
import { Solution, SolutionDocument, SolutionMember } from './schemas/solution.schema';

const VERSION_CONTROL_URL = process.env.VERSION_CONTROL_URL ?? 'http://localhost:3026';

@Injectable()
export class SolutionsService {
  constructor(@InjectModel(Solution.name) private readonly model: Model<SolutionDocument>) {}

  async create(dto: CreateSolutionDto) {
    const existing = await this.model.findOne({ key: dto.key }).lean();
    if (existing) throw new ConflictException(`Solution "${dto.key}" existiert bereits.`);
    const doc = await this.model.create({ ...dto, members: [] });
    return doc.toObject();
  }

  list(sourceRepositoryKey?: string) {
    return this.model
      .find(sourceRepositoryKey ? { sourceRepositoryKey } : {})
      .sort({ name: 1 })
      .lean();
  }

  async findOne(key: string) {
    const doc = await this.model.findOne({ key }).lean();
    if (!doc) throw new NotFoundException(`Solution "${key}" wurde nicht gefunden.`);
    return doc;
  }

  async remove(key: string): Promise<void> {
    await this.findOne(key);
    await this.model.deleteOne({ key });
  }

  async addMember(key: string, dto: AddMemberDto) {
    const solution = await this.findOne(key);
    const alreadyMember = solution.members.some(
      (m) => m.resourceType === dto.resourceType && m.resourceKey === dto.resourceKey,
    );
    if (alreadyMember) return solution;
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'solution',
      resourceKey: key,
      snapshot: solution,
    });
    return this.model.findOneAndUpdate({ key }, { $push: { members: dto } }, { new: true }).lean();
  }

  async removeMember(key: string, resourceType: string, resourceKey: string) {
    const before = await this.findOne(key);
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'solution',
      resourceKey: key,
      snapshot: before,
    });
    const doc = await this.model
      .findOneAndUpdate({ key }, { $pull: { members: { resourceType, resourceKey } } }, { new: true })
      .lean();
    return doc!;
  }

  /** Replaces the whole member list in one write — how "Repository deployen" (update mode) snapshots a repository's current members onto its linked Solution. */
  async setMembers(key: string, members: SolutionMember[]) {
    const before = await this.findOne(key);
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'solution',
      resourceKey: key,
      snapshot: before,
    });
    const doc = await this.model.findOneAndUpdate({ key }, { members }, { new: true }).lean();
    return doc!;
  }
}
