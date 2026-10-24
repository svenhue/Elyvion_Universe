export type FieldType = 'string' | 'number' | 'boolean' | 'date';

export interface FieldDef {
  name: string;
  type: FieldType;
  required: boolean;
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
