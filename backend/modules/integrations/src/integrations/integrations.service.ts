import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateIntegrationDto } from './dto/integrations.dto';
import { ProviderRegistry } from './providers/provider-registry';
import { Integration, IntegrationDocument } from './schemas/integration.schema';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(Integration.name) private readonly model: Model<IntegrationDocument>,
    private readonly providers: ProviderRegistry,
  ) {}

  async create(dto: CreateIntegrationDto) {
    const existing = await this.model.findOne({ key: dto.key }).lean();
    if (existing) throw new ConflictException(`Integration "${dto.key}" existiert bereits.`);
    this.providers.get(dto.provider); // validates the provider key exists
    const doc = await this.model.create(dto);
    return doc.toObject();
  }

  list() {
    return this.model.find().sort({ name: 1 }).lean();
  }

  async findOne(key: string) {
    const doc = await this.model.findOne({ key }).lean();
    if (!doc) throw new NotFoundException(`Integration "${key}" wurde nicht gefunden.`);
    return doc;
  }

  async remove(key: string): Promise<void> {
    await this.findOne(key);
    await this.model.deleteOne({ key });
  }

  async executeAction(integrationKey: string, actionKey: string, input: Record<string, unknown>): Promise<unknown> {
    const integration = await this.findOne(integrationKey);
    const provider = this.providers.get(integration.provider);
    const action = provider.actions.find((candidate) => candidate.key === actionKey);
    if (!action) {
      throw new NotFoundException(`Action "${actionKey}" ist für Provider "${integration.provider}" nicht bekannt.`);
    }
    return action.call(integration.connectionConfig, input);
  }
}
