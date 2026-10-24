import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Supported connector types. New source systems register a new type here plus a matching `DataAdapterConnector` — see `connectors/connector-registry.ts`. */
export const ADAPTER_TYPES = ['http', 'file', 'jdbc', 'sap'] as const;
export type AdapterType = (typeof ADAPTER_TYPES)[number];

@Schema({ timestamps: true })
export class DataAdapterConfig {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ enum: ADAPTER_TYPES, required: true })
  type!: AdapterType;

  @Prop()
  description?: string;

  /** Connector-specific — validated per-type by that connector's `validateConfig`, not here (keeps this schema type-agnostic). */
  @Prop({ type: Object, required: true })
  connectionConfig!: Record<string, unknown>;

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
