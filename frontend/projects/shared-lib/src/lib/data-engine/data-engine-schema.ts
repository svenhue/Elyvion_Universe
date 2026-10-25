export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'text' | 'enum' | 'reference';
export const FIELD_TYPES: FieldType[] = ['string', 'number', 'boolean', 'date', 'text', 'enum', 'reference'];

export interface FieldDef {
  name: string;
  type: FieldType;
  required: boolean;
  /** `enum` only — the fixed set of allowed values. */
  options?: string[];
  /** `reference` only — the name of the entity this field points at. */
  referenceEntity?: string;
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
