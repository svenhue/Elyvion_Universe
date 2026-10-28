import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { recordVersion } from '@elyvion/shared';
import { EntityRegistryService } from '../entities/entity-registry.service';
import { FieldDef } from '../entities/schemas/entity-definition.schema';
import { buildFieldQuery, buildRecordSchema } from '../entities/schema-builder';

export type DataRecord = Record<string, unknown>;

const VERSION_CONTROL_URL = process.env.VERSION_CONTROL_URL ?? 'http://localhost:3026';

/** Query-param keys `list()` reserves for sorting/pagination — never treated as a field filter, even if an entity happens to define a field with one of these names. */
const RESERVED_QUERY_KEYS = new Set(['sort', 'limit', 'offset']);

export interface ListOptions {
  /** Comma-separated field names; a `-` prefix sorts that field descending (`?sort=-dueDate,title`). */
  sort?: string;
  limit?: string;
  offset?: string;
}

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

  /**
   * `filter` is a raw query-string map, always flat string values —
   * Express's default query parser here does NOT expand bracket
   * notation into nested objects (verified live: `?status[in]=a,b`
   * arrives as the single literal key `"status[in]"`, not
   * `{status:{in:'a,b'}}`), so `splitListParams` parses that `field[op]`
   * key pattern itself rather than relying on the query parser. A plain
   * key is an equality match (`?status=Done`, unchanged since this
   * always existed); `sort`/`limit`/`offset` are reserved for
   * `ListOptions`. Unknown field keys are ignored rather than rejected,
   * since a caller may pass through unrelated query params.
   */
  async list(entityName: string, filter?: Record<string, string>): Promise<DataRecord[]> {
    const model = await this.registry.getDataModel(entityName);
    const { fieldFilter, options } = splitListParams(filter);
    const query = Object.keys(fieldFilter).length ? await this.buildFilterQuery(entityName, fieldFilter) : {};

    let cursor = model.find(query);
    if (options.sort) cursor = cursor.sort(parseSort(options.sort));
    if (options.offset) cursor = cursor.skip(Number(options.offset));
    if (options.limit) cursor = cursor.limit(Number(options.limit));

    return (await cursor.lean()).map(toDataRecord);
  }

  private async buildFilterQuery(
    entityName: string,
    filter: Record<string, string | Record<string, string>>,
  ): Promise<Record<string, unknown>> {
    const fields = await this.registry.getFields(entityName);
    const byName = new Map(fields.map((field) => [field.name, field]));
    const query: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      const field = byName.get(key);
      if (!field) continue;
      query[key] = buildFieldQuery(field.type, value);
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
    const before = await model.findById(id).lean();
    if (!before) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);

    assertAllowedTransitions(fields, before as DataRecord, parsed.data);

    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: `entity:${entityName}`,
      resourceKey: id,
      snapshot: toDataRecord(before),
    });

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

/** Matches a bracket-operator key as this query parser actually delivers it — e.g. `"dueDate[gte]"` as one literal string key, never a nested `{dueDate: {gte: ...}}` object. */
const OPERATOR_KEY_PATTERN = /^(.+)\[(\w+)\]$/;

function splitListParams(filter?: Record<string, string>): {
  fieldFilter: Record<string, string | Record<string, string>>;
  options: ListOptions;
} {
  const fieldFilter: Record<string, string | Record<string, string>> = {};
  const options: ListOptions = {};
  for (const [key, value] of Object.entries(filter ?? {})) {
    const operatorMatch = OPERATOR_KEY_PATTERN.exec(key);
    if (operatorMatch) {
      const [, field, op] = operatorMatch;
      const existing = fieldFilter[field];
      const operatorMap = existing && typeof existing === 'object' ? existing : {};
      fieldFilter[field] = { ...operatorMap, [op]: value };
    } else if (RESERVED_QUERY_KEYS.has(key)) {
      (options as Record<string, string>)[key] = value;
    } else {
      fieldFilter[key] = value;
    }
  }
  return { fieldFilter, options };
}

function parseSort(sort: string): Record<string, 1 | -1> {
  const result: Record<string, 1 | -1> = {};
  for (const part of sort.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) {
      result[trimmed.slice(1)] = -1;
    } else {
      result[trimmed] = 1;
    }
  }
  return result;
}

/**
 * Enforces each `enum` field's own `transitions` map, when it has one — "Offen"
 * can only move to whatever `transitions.Offen` lists, never straight to an
 * arbitrary other option. A field with no entry for its current value (or no
 * `transitions` map at all) is unrestricted, same as before this existed.
 */
function assertAllowedTransitions(fields: FieldDef[], before: DataRecord, patch: DataRecord): void {
  for (const field of fields) {
    if (field.type !== 'enum' || !field.transitions) continue;
    if (!(field.name in patch)) continue;
    const from = before[field.name] as string | undefined;
    const to = patch[field.name] as string;
    if (from === undefined || from === to) continue;
    const allowed = field.transitions[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(
        `Feld "${field.name}" darf nicht von "${from}" nach "${to}" wechseln (erlaubt: ${allowed?.join(', ') || 'keine Übergänge definiert'}).`,
      );
    }
  }
}

function toDataRecord(doc: Record<string, unknown>): DataRecord {
  const { _id, __v, ...fields } = doc;
  return { id: String(_id), ...fields };
}
