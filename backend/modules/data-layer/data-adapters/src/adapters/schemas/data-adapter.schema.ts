import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Supported connector types. New source systems register a new type here plus a matching `DataAdapterConnector` — see `connectors/connector-registry.ts`. */
export const ADAPTER_TYPES = ['http', 'file', 'jdbc', 'sap'] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

export interface DataAdapterSecretReference {
  id: string;
  name: string;
  type: string;
  status: string;
  version: number;
  reference: string;
  configKey: string;
}

@Schema({ timestamps: true })
export class DataAdapterConfig {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  environmentId!: string;

  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  ownerId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ enum: ADAPTER_TYPES, required: true })
  type!: AdapterType;

  @Prop()
  description?: string;

  /** Connector-specific — validated per-type by that connector's `validateConfig`, not here (keeps this schema type-agnostic). */
  @Prop({ type: Object, required: true })
  connectionConfig!: Record<string, unknown>;

  @Prop({ type: [Object], default: [] })
  secretReferences!: DataAdapterSecretReference[];

  /** Cron expression (e.g. `*​/5 * * * *`); absent means "manual trigger only". */
  @Prop()
  schedule?: string;

  @Prop({ default: true })
  enabled!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DataAdapterConfigDocument = DataAdapterConfig & Document;
export const DataAdapterConfigSchema = SchemaFactory.createForClass(DataAdapterConfig);
DataAdapterConfigSchema.index({ tenantId: 1, environmentId: 1, workspaceId: 1, name: 1 }, { unique: true });
