import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const DEPLOYMENT_STATUSES = ['pending', 'building', 'running', 'failed', 'stopped'] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

@Schema({ timestamps: true })
export class Deployment {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: Types.ObjectId, ref: 'DeploymentTarget', required: true })
  targetId!: Types.ObjectId;

  /** The Solution (bundle of apps/workflows/agents) this deployment deploys as a unit, if any — see the `solutions` module. Optional: a deployment can still just be an ad-hoc single build. */
  @Prop()
  solutionKey?: string;

  @Prop({ enum: DEPLOYMENT_STATUSES, default: 'pending' })
  status!: DeploymentStatus;

  /** Executor-assigned handle (e.g. a Docker container id) — opaque outside the executor that produced it. */
  @Prop()
  handle?: string;

  @Prop()
  port?: number;

  @Prop()
  url?: string;

  @Prop()
  error?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DeploymentDocument = Deployment & Document;
export const DeploymentSchema = SchemaFactory.createForClass(Deployment);
