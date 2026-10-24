import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Where a deployment runs. New cloud providers register a new type here plus a matching `DeploymentExecutor` — see `executors/executor-registry.ts`. */
export const TARGET_TYPES = ['local-docker', 'aws', 'gcp', 'azure'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

@Schema({ timestamps: true })
export class DeploymentTarget {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop({ enum: TARGET_TYPES, required: true })
  type!: TargetType;

  /** Executor-specific — e.g. a region/credentials/cluster for a cloud target. Validated per-type by that executor, not here. */
  @Prop({ type: Object, default: {} })
  config!: Record<string, unknown>;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DeploymentTargetDocument = DeploymentTarget & Document;
export const DeploymentTargetSchema = SchemaFactory.createForClass(DeploymentTarget);
