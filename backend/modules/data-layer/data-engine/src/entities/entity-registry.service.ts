import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { CreateEntityDto } from './dto/entities.dto';
import { buildMongooseSchema, dataCollectionName } from './schema-builder';
import { EntityDefinition, EntityDefinitionDocument, FieldDef } from './schemas/entity-definition.schema';

export interface EntityDefinitionRecord {
  name: string;
  tenantId: string;
  fields: FieldDef[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Owns the one thing a generic "define an entity, get a table and a REST
 * API" feature needs that a NestJS app doesn't give you for free: a data
 * model for a name nobody knew at compile time. Mongoose's
 * `Connection.model()` can register a schema at any point while the
 * process is running, not just at bootstrap — so a new entity gets a real
 * working collection the instant `define()` returns, no restart, no code
 * generation. `DataService` is the only other thing that calls here; it
 * never talks to Mongoose directly.
 */
@Injectable()
export class EntityRegistryService implements OnModuleInit {
  private readonly dataModels = new Map<string, Model<Record<string, unknown>>>();

  constructor(
    @InjectModel(EntityDefinition.name) private readonly definitions: Model<EntityDefinitionDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    const collection = this.definitions.collection;
    let indexes;
    try {
      indexes = await collection.indexes();
    } catch (error) {
      if (!isMissingCollection(error)) throw error;
      indexes = [];
    }

    const legacyUniqueNameIndex = indexes.find((index) =>
      index.name === 'name_1' &&
      index.unique === true &&
      Object.keys(index.key).length === 1 &&
      index.key['name'] === 1,
    );
    if (legacyUniqueNameIndex?.name) {
      await collection.dropIndex(legacyUniqueNameIndex.name);
    }
    await collection.createIndex(
      { tenantId: 1, name: 1 },
      { unique: true, name: 'tenantId_1_name_1' },
    );
  }

  async define(dto: CreateEntityDto, tenantId: string): Promise<EntityDefinitionRecord> {
    const existing = await this.definitions.findOne({ name: dto.name, tenantId }).lean();
    if (existing) {
      throw new ConflictException(`Entität "${dto.name}" existiert bereits.`);
    }
    const doc = await this.definitions.create({ name: dto.name, tenantId, fields: dto.fields });
    return toRecord(doc);
  }

  async list(tenantId: string): Promise<EntityDefinitionRecord[]> {
    return (await this.definitions.find({ tenantId }).lean()).map(toRecord);
  }

  async get(name: string, tenantId: string): Promise<EntityDefinitionRecord> {
    const doc = await this.definitions.findOne({ name, tenantId }).lean();
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    return toRecord(doc);
  }

  async remove(name: string, tenantId: string): Promise<void> {
    const doc = await this.definitions.findOneAndDelete({ name, tenantId });
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    this.dataModels.delete(modelCacheKey(name, tenantId));
    await this.connection.dropCollection(dataCollectionName(name, tenantId)).catch(() => undefined);
  }

  async getFields(name: string, tenantId: string): Promise<FieldDef[]> {
    const doc = await this.definitions.findOne({ name, tenantId }).lean();
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    return doc.fields;
  }

  /** The entity's own dynamic data model — created on first use, cached after that (the schema can only change by deleting and redefining the entity, so there's no staleness to guard against). */
  async getDataModel(name: string, tenantId: string): Promise<Model<Record<string, unknown>>> {
    const cacheKey = modelCacheKey(name, tenantId);
    const cached = this.dataModels.get(cacheKey);
    if (cached) return cached;

    const fields = await this.getFields(name, tenantId);
    const collectionName = dataCollectionName(name, tenantId);
    const model =
      (this.connection.models[collectionName] as Model<Record<string, unknown>> | undefined) ??
      this.connection.model<Record<string, unknown>>(collectionName, buildMongooseSchema(fields), collectionName);
    this.dataModels.set(cacheKey, model);
    return model;
  }
}

function modelCacheKey(name: string, tenantId: string): string {
  return `${tenantId}:${name}`;
}

function isMissingCollection(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 26;
}

function toRecord(doc: EntityDefinition & { _id: unknown }): EntityDefinitionRecord {
  return {
    name: doc.name,
    tenantId: doc.tenantId,
    fields: doc.fields,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
