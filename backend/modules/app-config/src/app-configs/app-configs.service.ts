import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig, AppConfigDocument } from './schemas/app-config.schema';
import { ResolveSchemaRequest, UpsertAppConfigDto } from './dto/resolve-schema.dto';

@Injectable()
export class AppConfigsService {
  private readonly logger = new Logger(AppConfigsService.name);

  constructor(@InjectModel(AppConfig.name) private readonly model: Model<AppConfigDocument>) {}

  /**
   * Resolves the schema for a given application/user. `userId`/`settings`
   * aren't used to personalize the schema yet — they're accepted (and
   * logged) so per-user variants can be layered in later without changing
   * the contract the frontend's DynamicAppService already relies on.
   */
  async resolve(request: ResolveSchemaRequest) {
    this.logger.log(`Resolving schema "${request.applicationId}" for user "${request.userId}"`);
    const config = await this.model.findOne({ applicationId: request.applicationId }).lean();
    if (!config) {
      throw new NotFoundException(`No app config for applicationId "${request.applicationId}"`);
    }
    return config;
  }

  findAll() {
    return this.model.find().lean();
  }

  async findOne(applicationId: string) {
    const config = await this.model.findOne({ applicationId }).lean();
    if (!config) {
      throw new NotFoundException(`No app config for applicationId "${applicationId}"`);
    }
    return config;
  }

  upsert(dto: UpsertAppConfigDto) {
    return this.model
      .findOneAndUpdate({ applicationId: dto.applicationId }, dto, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .lean();
  }

  async remove(applicationId: string) {
    const result = await this.model.deleteOne({ applicationId });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`No app config for applicationId "${applicationId}"`);
    }
  }
}
