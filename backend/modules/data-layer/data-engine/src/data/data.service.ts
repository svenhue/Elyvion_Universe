import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationObligations, recordVersion } from '@elyvion/shared';
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
  async list(
    entityName: string,
    tenantId: string,
    filter?: Record<string, string>,
    obligations: AuthorizationObligations = {},
  ): Promise<DataRecord[]> {
    const model = await this.registry.getDataModel(entityName, tenantId);
    const fields = await this.registry.getFields(entityName, tenantId);
    const { fieldFilter, options } = splitListParams(filter);
    const query = Object.keys(fieldFilter).length
      ? await this.buildFilterQuery(entityName, tenantId, fieldFilter)
      : {};
    const policyFilter = buildPolicyRowFilter(fields, obligations.rowFilter);
    const queryParts: Record<string, unknown>[] = [{ tenantId }];
    if (Object.keys(query).length) queryParts.push(query);
    if (Object.keys(policyFilter).length) queryParts.push(policyFilter);

    let cursor = model.find({ $and: queryParts });
    if (options.sort) cursor = cursor.sort(parseSort(options.sort));
    if (options.offset) cursor = cursor.skip(Number(options.offset));
    const requestedLimit = options.limit ? Number(options.limit) : undefined;
    const effectiveLimit = obligations.maxRows === undefined
      ? requestedLimit
      : Math.min(requestedLimit ?? obligations.maxRows, obligations.maxRows);
    if (effectiveLimit !== undefined) cursor = cursor.limit(effectiveLimit);

    return maskRecords((await cursor.lean()).map(toDataRecord), obligations.maskColumns ?? []);
  }

  private async buildFilterQuery(
    entityName: string,
    tenantId: string,
    filter: Record<string, string | Record<string, string>>,
  ): Promise<Record<string, unknown>> {
    const fields = await this.registry.getFields(entityName, tenantId);
    const byName = new Map(fields.map((field) => [field.name, field]));
    const query: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(filter)) {
      const field = byName.get(key);
      if (!field) continue;
      query[key] = buildFieldQuery(field.type, value);
    }
    return query;
  }

  async get(
    entityName: string,
    id: string,
    tenantId: string,
    obligations: AuthorizationObligations = {},
  ): Promise<DataRecord> {
    const model = await this.registry.getDataModel(entityName, tenantId);
    const fields = await this.registry.getFields(entityName, tenantId);
    const policyFilter = buildPolicyRowFilter(fields, obligations.rowFilter);
    const doc = await model.findOne({ $and: [{ _id: id, tenantId }, policyFilter] }).lean();
    if (!doc) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
    return maskRecord(toDataRecord(doc), obligations.maskColumns ?? []);
  }

  async create(
    entityName: string,
    input: unknown,
    tenantId: string,
    obligations: AuthorizationObligations = {},
  ): Promise<DataRecord> {
    const fields = await this.registry.getFields(entityName, tenantId);
    const parsed = buildRecordSchema(fields).safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const policyFilter = buildPolicyRowFilter(fields, obligations.rowFilter);
    if (!matchesPolicyFilter(parsed.data, policyFilter)) {
      throw new ForbiddenException('Record does not satisfy the authorization row filter');
    }
    const model = await this.registry.getDataModel(entityName, tenantId);
    const doc = await model.create({ ...parsed.data, tenantId });
    return maskRecord(toDataRecord(doc.toObject()), obligations.maskColumns ?? []);
  }

  async update(
    entityName: string,
    id: string,
    input: unknown,
    tenantId: string,
    obligations: AuthorizationObligations = {},
  ): Promise<DataRecord> {
    const fields = await this.registry.getFields(entityName, tenantId);
    const parsed = buildRecordSchema(fields).partial().safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const policyFilter = buildPolicyRowFilter(fields, obligations.rowFilter);
    const model = await this.registry.getDataModel(entityName, tenantId);
    const before = await model.findOne({ $and: [{ _id: id, tenantId }, policyFilter] }).lean();
    if (!before) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);

    assertAllowedTransitions(fields, before as DataRecord, parsed.data);
    if (!matchesPolicyFilter({ ...before, ...parsed.data }, policyFilter)) {
      throw new ForbiddenException('Updated record does not satisfy the authorization row filter');
    }

    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: `entity:${entityName}`,
      resourceKey: id,
      snapshot: toDataRecord(before),
    });

    const doc = await model.findOneAndUpdate(
      { $and: [{ _id: id, tenantId }, policyFilter] },
      parsed.data,
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
    return maskRecord(toDataRecord(doc), obligations.maskColumns ?? []);
  }

  async remove(
    entityName: string,
    id: string,
    tenantId: string,
    obligations: AuthorizationObligations = {},
  ): Promise<void> {
    const fields = await this.registry.getFields(entityName, tenantId);
    const policyFilter = buildPolicyRowFilter(fields, obligations.rowFilter);
    const model = await this.registry.getDataModel(entityName, tenantId);
    const result = await model.findOneAndDelete({ $and: [{ _id: id, tenantId }, policyFilter] });
    if (!result) throw new NotFoundException(`Datensatz "${id}" wurde nicht gefunden.`);
  }
}

function buildPolicyRowFilter(
  fields: FieldDef[],
  rowFilter: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!rowFilter) return {};
  const allowedFields = new Set(fields.map((field) => field.name));
  const result: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(rowFilter)) {
    if (
      field === 'tenantId' ||
      field.startsWith('$') ||
      field.includes('.') ||
      !allowedFields.has(field) ||
      (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
    ) {
      throw new BadGatewayException('Authorization service returned an invalid row filter');
    }
    result[field] = value;
  }
  return result;
}

function maskRecords(records: DataRecord[], columns: string[]): DataRecord[] {
  return records.map((record) => maskRecord(record, columns));
}

function maskRecord(record: DataRecord, columns: string[]): DataRecord {
  if (!columns.length) return record;
  const masked = { ...record };
  for (const column of columns) {
    if (Object.prototype.hasOwnProperty.call(masked, column)) masked[column] = '[REDACTED]';
  }
  return masked;
}

function matchesPolicyFilter(record: DataRecord, policyFilter: Record<string, unknown>): boolean {
  return Object.entries(policyFilter).every(([field, value]) => record[field] === value);
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
