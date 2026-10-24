import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityRegistryService } from '../entities/entity-registry.service';
import { buildRecordSchema } from '../entities/schema-builder';

export type DataRecord = Record<string, unknown>;

/**
 * Generic CRUD over whatever entity `EntityRegistryService` knows about —
 * one implementation for every entity a user defines, rather than a
 * controller/service pair generated per entity. Every write is validated
 * against that entity's own field schema first (see `buildRecordSchema`),
 * so a wrong type or a missing required field is a clear 400, not a
 * Mongoose cast error.
 */
@Injectable()
export class DataService {
  constructor(private readonly registry: EntityRegistryService) {}

  async list(entityName: string): Promise<DataRecord[]> {
    const model = await this.registry.getDataModel(entityName);
    return (await model.find().lean()).map(toDataRecord);
  }

  async get(entityName: string, id: string): Promise<DataRecord> {
    const model = await this.registry.getDataModel(entityName);
    const doc = await model.findById(id).lean();
    if (!doc) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
    return toDataRecord(doc);
  }

  async create(entityName: string, input: unknown): Promise<DataRecord> {
    const fields = await this.registry.getFields(entityName);
    const parsed = buildRecordSchema(fields).safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const model = await this.registry.getDataModel(entityName);
    const doc = await model.create(parsed.data);
    return toDataRecord(doc.toObject());
  }

  async update(entityName: string, id: string, input: unknown): Promise<DataRecord> {
    const fields = await this.registry.getFields(entityName);
    const parsed = buildRecordSchema(fields).partial().safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const model = await this.registry.getDataModel(entityName);
    const doc = await model.findByIdAndUpdate(id, parsed.data, { new: true }).lean();
    if (!doc) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
    return toDataRecord(doc);
  }

  async remove(entityName: string, id: string): Promise<void> {
    const model = await this.registry.getDataModel(entityName);
    const result = await model.findByIdAndDelete(id);
    if (!result) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
  }
}

function toDataRecord(doc: Record<string, unknown>): DataRecord {
  const { _id, __v, ...fields } = doc;
  return { id: String(_id), ...fields };
}
