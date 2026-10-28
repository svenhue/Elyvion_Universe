import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** One execution of a data adapter's stream — manually triggered or by its cron schedule. */
@Schema()
export class DataAdapterRun {
  @Prop({ type: Types.ObjectId, ref: 'DataAdapterConfig', required: true, index: true })
  adapterId!: Types.ObjectId;

  @Prop({ enum: RUN_STATUSES, default: 'running' })
  status!: RunStatus;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop()
  finishedAt?: Date;

  @Prop()
  recordsProcessed?: number;

  @Prop()
  error?: string;
}

export type DataAdapterRunDocument = DataAdapterRun & Document;
export const DataAdapterRunSchema = SchemaFactory.createForClass(DataAdapterRun);
