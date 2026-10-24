import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model } from 'mongoose';
import { CreateDeploymentDto, CreateTargetDto } from './dto/deployments.dto';
import { ExecutorRegistry } from './executors/executor-registry';
import { Deployment, DeploymentDocument } from './schemas/deployment.schema';
import { DeploymentTarget, DeploymentTargetDocument } from './schemas/deployment-target.schema';

const TELEMETRY_URL = process.env.TELEMETRY_URL ?? 'http://localhost:3020';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    @InjectModel(DeploymentTarget.name) private readonly targets: Model<DeploymentTargetDocument>,
    @InjectModel(Deployment.name) private readonly deployments: Model<DeploymentDocument>,
    private readonly executors: ExecutorRegistry,
  ) {}

  async createTarget(dto: CreateTargetDto) {
    const existing = await this.targets.findOne({ name: dto.name }).lean();
    if (existing) throw new ConflictException(`Deployment-Ziel "${dto.name}" existiert bereits.`);
    this.executors.get(dto.type).validateConfig(dto.config);
    const doc = await this.targets.create(dto);
    return doc.toObject();
  }

  listTargets() {
    return this.targets.find().sort({ name: 1 }).lean();
  }

  async findTarget(id: string) {
    const doc = await this.targets.findById(id).lean();
    if (!doc) throw new NotFoundException(`Deployment-Ziel "${id}" wurde nicht gefunden.`);
    return doc;
  }

  /** Builds + runs the application on the given target — "einen Docker-Container lokal erstellen" for `local-docker`. */
  async deploy(dto: CreateDeploymentDto) {
    const target = await this.findTarget(dto.targetId);
    const deployment = await this.deployments.create({ name: dto.name, targetId: target._id, status: 'building' });

    try {
      const result = await this.executors.get(target.type).deploy(dto.name, target.config);
      await this.deployments.findByIdAndUpdate(deployment._id, {
        status: 'running',
        handle: result.handle,
        port: result.port,
        url: result.url,
      });
      if (result.url) {
        await this.registerWithTelemetry(dto.name, result.url);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.deployments.findByIdAndUpdate(deployment._id, { status: 'failed', error: message });
      throw err;
    }
    return this.deployments.findById(deployment._id).lean();
  }

  list() {
    return this.deployments.find().sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    const doc = await this.deployments.findById(id).lean();
    if (!doc) throw new NotFoundException(`Deployment "${id}" wurde nicht gefunden.`);
    return doc;
  }

  /** Live status from the executor (e.g. an actual `docker inspect`), not just the last stored transition — independent of whatever the deployed application itself reports. */
  async getLiveStatus(id: string): Promise<Record<string, unknown>> {
    const deployment = await this.findOne(id);
    if (!deployment.handle) return { ...deployment, liveStatus: 'unknown' as const };
    const target = await this.findTarget(String(deployment.targetId));
    const liveStatus = await this.executors.get(target.type).getStatus(deployment.handle, target.config);
    return { ...deployment, liveStatus };
  }

  async stop(id: string) {
    const deployment = await this.findOne(id);
    if (deployment.handle) {
      const target = await this.findTarget(String(deployment.targetId));
      await this.executors.get(target.type).stop(deployment.handle, target.config);
    }
    return this.deployments.findByIdAndUpdate(id, { status: 'stopped' }, { new: true }).lean();
  }

  private async registerWithTelemetry(name: string, url: string): Promise<void> {
    try {
      await axios.post(`${TELEMETRY_URL}/health/targets`, { name: `deployment:${name}`, url, source: 'deployment' }, { timeout: 2000 });
    } catch (err) {
      this.logger.warn(`Could not register deployment "${name}" with telemetry: ${err instanceof Error ? err.message : err}`);
    }
  }
}
