import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { CreateDeploymentDto, CreateTargetDto } from './dto/deployments.dto';
import { ExecutorRegistry } from './executors/executor-registry';
import { Deployment, DeploymentDocument } from './schemas/deployment.schema';
import { DeploymentTarget, DeploymentTargetDocument } from './schemas/deployment-target.schema';

const TELEMETRY_URL = process.env.TELEMETRY_URL ?? 'http://localhost:3020';

@Injectable()
export class DeploymentsService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    @InjectModel(DeploymentTarget.name) private readonly targets: Model<DeploymentTargetDocument>,
    @InjectModel(Deployment.name) private readonly deployments: Model<DeploymentDocument>,
    private readonly executors: ExecutorRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const collection = this.targets.collection;
    let indexes;
    try {
      indexes = await collection.indexes();
    } catch (error) {
      if (!this.isMissingCollection(error)) throw error;
      indexes = [];
    }
    const legacyUniqueNameIndex = indexes.find((index) =>
      index.name === 'name_1' &&
      index.unique === true &&
      Object.keys(index.key).length === 1 &&
      index.key['name'] === 1,
    );
    if (legacyUniqueNameIndex?.name) {
      await collection.dropIndex(legacyUniqueNameIndex.name);
    }
    await collection.createIndex(
      { tenantId: 1, name: 1 },
      { unique: true, name: 'tenantId_1_name_1' },
    );
  }

  private isMissingCollection(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'code' in error && error.code === 26;
  }

  async createTarget(dto: CreateTargetDto, tenantId: string) {
    const existing = await this.targets.findOne({ name: dto.name, tenantId }).lean();
    if (existing) throw new ConflictException(`Deployment-Ziel "${dto.name}" existiert bereits.`);
    this.executors.get(dto.type).validateConfig(dto.config);
    const doc = await this.targets.create({ ...dto, tenantId });
    return doc.toObject();
  }

  listTargets(tenantId: string) {
    return this.targets.find({ tenantId }).sort({ name: 1 }).lean();
  }

  async findTarget(id: string, tenantId: string) {
    const doc = await this.targets.findOne({ _id: id, tenantId }).lean();
    if (!doc) throw new NotFoundException(`Deployment-Ziel "${id}" wurde nicht gefunden.`);
    return doc;
  }

  /** Builds + runs the application on the given target — "einen Docker-Container lokal erstellen" for `local-docker`. */
  async deploy(dto: CreateDeploymentDto, tenantId: string) {
    const target = await this.findTarget(dto.targetId, tenantId);
    const deployment = await this.deployments.create({
      name: dto.name,
      tenantId,
      targetId: target._id,
      solutionKey: dto.solutionKey,
      status: 'building',
    });

    try {
      const result = await this.executors.get(target.type).deploy(dto.name, target.config);
      await this.deployments.findOneAndUpdate(
        { _id: deployment._id, tenantId },
        {
          status: 'running',
          handle: result.handle,
          port: result.port,
          url: result.url,
        },
      );
      if (result.url) {
        await this.registerWithTelemetry(dto.name, result.url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.deployments.findOneAndUpdate(
        { _id: deployment._id, tenantId },
        { status: 'failed', error: message },
      );
      throw err;
    }
    return this.deployments.findById(deployment._id).lean();
  }

  list(tenantId: string, solutionKey?: string) {
    return this.deployments
      .find({ tenantId, ...(solutionKey ? { solutionKey } : {}) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string, tenantId: string) {
    const doc = await this.deployments.findOne({ _id: id, tenantId }).lean();
    if (!doc) throw new NotFoundException(`Deployment "${id}" wurde nicht gefunden.`);
    return doc;
  }

  /** Live status from the executor (e.g. an actual `docker inspect`), not just the last stored transition — independent of whatever the deployed application itself reports. */
  async getLiveStatus(id: string, tenantId: string): Promise<Record<string, unknown>> {
    const deployment = await this.findOne(id, tenantId);
    if (!deployment.handle) return { ...deployment, liveStatus: 'unknown' as const };
    const target = await this.findTarget(String(deployment.targetId), tenantId);
    const liveStatus = await this.executors.get(target.type).getStatus(deployment.handle, target.config);
    return { ...deployment, liveStatus };
  }

  async stop(id: string, tenantId: string) {
    const deployment = await this.findOne(id, tenantId);
    if (deployment.handle) {
      const target = await this.findTarget(String(deployment.targetId), tenantId);
      await this.executors.get(target.type).stop(deployment.handle, target.config);
    }
    return this.deployments.findOneAndUpdate(
      { _id: id, tenantId },
      { status: 'stopped' },
      { new: true },
    ).lean();
  }

  private async registerWithTelemetry(name: string, url: string): Promise<void> {
    try {
      await axios.post(`${TELEMETRY_URL}/health/targets`, { name: `deployment:${name}`, url, source: 'deployment' }, { timeout: 2000 });
    } catch (err) {
      this.logger.warn(`Could not register deployment "${name}" with telemetry: ${err instanceof Error ? err.message : err}`);
    }
  }
}
