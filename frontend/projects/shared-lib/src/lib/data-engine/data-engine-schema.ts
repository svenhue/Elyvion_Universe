export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'text'
  | 'enum'
  | 'reference'
  | 'multi_enum'
  | 'multi_reference'
  | 'file';
export const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'text',
  'enum',
  'reference',
  'multi_enum',
  'multi_reference',
  'file',
];

export interface FieldDef {
  name: string;
  type: FieldType;
  required: boolean;
  /** `enum`/`multi_enum` only — the fixed set of allowed values. */
  options?: string[];
  /** `reference`/`multi_reference` only — the name of the entity this field points at. */
  referenceEntity?: string;
  /** `enum` only, optional — allowed transitions out of each value; a value with no entry may move to any other option. */
  transitions?: Record<string, string[]>;
}

export interface EntityDefinition {
  name: string;
  fields: FieldDef[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityPayload {
  name: string;
  fields: FieldDef[];
}

/** One record from an entity's data collection — `id` plus whatever fields that entity declares. */
export type DataRecord = { id: string } & Record<string, unknown>;
