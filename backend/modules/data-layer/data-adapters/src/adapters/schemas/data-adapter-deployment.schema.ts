import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AdapterType, DataAdapterSecretReference } from './data-adapter.schema';

export const DATA_ADAPTER_DEPLOYMENT_STATUSES = ['pending', 'deployed', 'failed'] as const;
export type DataAdapterDeploymentStatus = (typeof DATA_ADAPTER_DEPLOYMENT_STATUSES)[number];

@Schema({ timestamps: true })
export class DataAdapterDeployment {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  sourceWorkspaceId!: string;

  @Prop({ required: true })
  sourceEnvironmentId!: string;

  @Prop({ required: true })
  sourceAdapterId!: string;

  @Prop({ required: true })
  targetWorkspaceId!: string;

  @Prop({ required: true })
  targetEnvironmentId!: string;

  @Prop({ required: true })
  targetAdapterId!: string;

  @Prop({ enum: DATA_ADAPTER_DEPLOYMENT_STATUSES, default: 'pending' })
  status!: DataAdapterDeploymentStatus;

  @Prop({ type: Object, required: true })
  manifest!: {
    name: string;
    type: AdapterType;
    description?: string;
    connectionConfig: Record<string, unknown>;
    secretReferences: DataAdapterSecretReference[];
    schedule?: string;
    enabled: boolean;
  };

  @Prop()
  deployedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DataAdapterDeploymentDocument = DataAdapterDeployment & Document;
export const DataAdapterDeploymentSchema = SchemaFactory.createForClass(DataAdapterDeployment);
DataAdapterDeploymentSchema.index({ tenantId: 1, sourceAdapterId: 1, createdAt: -1 });
DataAdapterDeploymentSchema.index({ tenantId: 1, targetEnvironmentId: 1, targetAdapterId: 1, createdAt: -1 });
