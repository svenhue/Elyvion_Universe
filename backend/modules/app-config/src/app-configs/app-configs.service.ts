import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig, AppConfigDocument, ComponentNode } from './schemas/app-config.schema';
import { AddElementDto, ResolveSchemaRequest, UpsertAppConfigDto } from './dto/resolve-schema.dto';

@Injectable()
export class AppConfigsService {
  private readonly logger = new Logger(AppConfigsService.name);

  constructor(@InjectModel(AppConfig.name) private readonly model: Model<AppConfigDocument>) {}

  /**
   * Resolves the schema for a given application/user. `userId`/`settings`
   * aren't used to personalize the schema yet — they're accepted (and
   * logged) so per-user variants can be layered in later without changing
   * the contract the frontend's DynamicAppService already relies on.
   *
   * Auto-creates a blank app on first load instead of 404ing: the builder
   * (pro-code) treats "no document yet" the same as "a brand new empty
   * application" rather than surfacing a load error for what is, from the
   * editor's perspective, the completely normal first-run state.
   */
  async resolve(request: ResolveSchemaRequest) {
    this.logger.log(`Resolving schema "${request.applicationId}" for user "${request.userId}"`);
    const config = await this.model.findOne({ applicationId: request.applicationId }).lean();
    if (config) return config;

    this.logger.log(`No app config for "${request.applicationId}" yet — bootstrapping a blank one`);
    return this.model
      .findOneAndUpdate(
        { applicationId: request.applicationId },
        {
          applicationId: request.applicationId,
          name: 'Neue Anwendung',
          version: '1.0.0',
          rootComponentId: 'root',
          components: [
            {
              id: 'root',
              type: 'element',
              element: 'main',
              attributes: { class: 'relative min-h-full w-full bg-white' },
              children: [],
            },
          ],
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
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

  /**
   * Adds a new element as a child of `parentId` — the `add_element` action
   * (see `main.ts`'s boot-time `registerRemoteAction` calls), what lets an
   * agent build out a live application instead of only ever replacing the
   * whole schema via `upsert`.
   */
  async addElement(applicationId: string, dto: AddElementDto) {
    const config = await this.findOne(applicationId);
    if (config.components.some((component) => component.id === dto.element.id)) {
      throw new BadRequestException(`Element "${dto.element.id}" existiert bereits.`);
    }
    const parentIndex = config.components.findIndex((component) => component.id === dto.parentId);
    if (parentIndex === -1) {
      throw new NotFoundException(`Eltern-Element "${dto.parentId}" wurde nicht gefunden.`);
    }

    const nextComponents = [...config.components, dto.element as ComponentNode];
    nextComponents[parentIndex] = {
      ...nextComponents[parentIndex],
      children: [...(nextComponents[parentIndex].children ?? []), dto.element.id],
    };

    return this.model.findOneAndUpdate({ applicationId }, { components: nextComponents }, { new: true }).lean();
  }

  /**
   * Merges `patch` into one existing element — `attributes` merges rather
   * than replaces wholesale, since that's the field an agent edits most
   * (e.g. a button's label or class) and a shallow replace would silently
   * drop every attribute the patch didn't mention.
   */
  async updateElement(applicationId: string, elementId: string, patch: Record<string, unknown>) {
    const config = await this.findOne(applicationId);
    const index = config.components.findIndex((component) => component.id === elementId);
    if (index === -1) {
      throw new NotFoundException(`Element "${elementId}" wurde nicht gefunden.`);
    }

    const existing = config.components[index];
    const patchedAttributes =
      patch['attributes'] && typeof patch['attributes'] === 'object'
        ? { ...(existing.attributes ?? {}), ...(patch['attributes'] as Record<string, unknown>) }
        : existing.attributes;

    const nextComponents = [...config.components];
    nextComponents[index] = { ...existing, ...patch, id: elementId, attributes: patchedAttributes } as typeof existing;

    return this.model.findOneAndUpdate({ applicationId }, { components: nextComponents }, { new: true }).lean();
  }
}
