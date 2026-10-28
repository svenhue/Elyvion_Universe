import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { recordVersion } from '@elyvion/shared';
import { CreateRuleDto, UpdateRuleDto } from './dto/rules.dto';
import { runRule } from './rule-executor';
import { Rule, RuleDocument } from './schemas/rule.schema';

const VERSION_CONTROL_URL = process.env.VERSION_CONTROL_URL ?? 'http://localhost:3026';

@Injectable()
export class RulesService {
  constructor(@InjectModel(Rule.name) private readonly model: Model<RuleDocument>) {}

  async create(dto: CreateRuleDto) {
    const existing = await this.model.findOne({ key: dto.key }).lean();
    if (existing) throw new ConflictException(`Regel "${dto.key}" existiert bereits.`);
    const doc = await this.model.create(dto);
    return doc.toObject();
  }

  list() {
    return this.model.find().sort({ name: 1 }).lean();
  }

  async findOne(key: string) {
    const doc = await this.model.findOne({ key }).lean();
    if (!doc) throw new NotFoundException(`Regel "${key}" wurde nicht gefunden.`);
    return doc;
  }

  async update(key: string, dto: UpdateRuleDto) {
    const before = await this.findOne(key);
    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'rule',
      resourceKey: key,
      snapshot: before,
    });
    const doc = await this.model.findOneAndUpdate({ key }, dto, { new: true }).lean();
    return doc!;
  }

  async remove(key: string): Promise<void> {
    await this.findOne(key);
    await this.model.deleteOne({ key });
  }

  async execute(key: string, input: unknown): Promise<{ output: unknown }> {
    const rule = await this.findOne(key);
    return { output: runRule(rule.blocks, input) };
  }
}
