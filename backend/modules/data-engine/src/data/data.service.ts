import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityRegistryService } from '../entities/entity-registry.service';
import { buildRecordSchema, coerceFilterValue } from '../entities/schema-builder';

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

  /** `filter` is a raw query-string map (e.g. `?status=Done&projectId=p1`) — unknown keys are ignored rather than rejected, since a caller may pass through unrelated query params. */
  async list(entityName: string, filter?: Record<string, string>): Promise<DataRecord[]> {
    const model = await this.registry.getDataModel(entityName);
    const query = filter && Object.keys(filter).length ? await this.buildFilterQuery(entityName, filter) : {};
    return (await model.find(query).lean()).map(toDataRecord);
  }

  private async buildFilterQuery(entityName: string, filter: Record<string, string>): Promise<Record<string, unknown>> {
    const fields = await this.registry.getFields(entityName);
    const byName = new Map(fields.map((field) => [field.name, field]));
    const query: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      const field = byName.get(key);
      if (!field) continue;
      query[key] = coerceFilterValue(field.type, value);
    }
    return query;
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
