import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { CreateEntityDto } from './dto/entities.dto';
import { buildMongooseSchema, dataCollectionName } from './schema-builder';
import { EntityDefinition, EntityDefinitionDocument, FieldDef } from './schemas/entity-definition.schema';

export interface EntityDefinitionRecord {
  name: string;
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
export class EntityRegistryService {
  private readonly dataModels = new Map<string, Model<Record<string, unknown>>>();

  constructor(
    @InjectModel(EntityDefinition.name) private readonly definitions: Model<EntityDefinitionDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async define(dto: CreateEntityDto): Promise<EntityDefinitionRecord> {
    const existing = await this.definitions.findOne({ name: dto.name }).lean();
    if (existing) {
      throw new ConflictException(`Entität "${dto.name}" existiert bereits.`);
    }
    const doc = await this.definitions.create({ name: dto.name, fields: dto.fields });
    return toRecord(doc);
  }

  async list(): Promise<EntityDefinitionRecord[]> {
    return (await this.definitions.find().lean()).map(toRecord);
  }

  async get(name: string): Promise<EntityDefinitionRecord> {
    const doc = await this.definitions.findOne({ name }).lean();
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    return toRecord(doc);
  }

  async remove(name: string): Promise<void> {
    const doc = await this.definitions.findOneAndDelete({ name });
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    this.dataModels.delete(name);
    await this.connection.dropCollection(dataCollectionName(name)).catch(() => undefined);
  }

  async getFields(name: string): Promise<FieldDef[]> {
    const doc = await this.definitions.findOne({ name }).lean();
    if (!doc) throw new NotFoundException(`Entität "${name}" wurde nicht gefunden.`);
    return doc.fields;
  }

  /** The entity's own dynamic data model — created on first use, cached after that (the schema can only change by deleting and redefining the entity, so there's no staleness to guard against). */
  async getDataModel(name: string): Promise<Model<Record<string, unknown>>> {
    const cached = this.dataModels.get(name);
    if (cached) return cached;

    const fields = await this.getFields(name);
    const collectionName = dataCollectionName(name);
    const model =
      (this.connection.models[collectionName] as Model<Record<string, unknown>> | undefined) ??
      this.connection.model<Record<string, unknown>>(collectionName, buildMongooseSchema(fields), collectionName);
    this.dataModels.set(name, model);
    return model;
  }
}

function toRecord(doc: EntityDefinition & { _id: unknown }): EntityDefinitionRecord {
  return {
    name: doc.name,
    fields: doc.fields,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
