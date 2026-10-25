import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Model, Types } from 'mongoose';
import { recordVersion } from '@elyvion/shared';
import { ConnectorRegistry } from './connectors/connector-registry';
import { CreateAdapterDto, UpdateAdapterDto } from './dto/adapters.dto';
import { DataAdapterConfig, DataAdapterConfigDocument } from './schemas/data-adapter.schema';
import { DataAdapterRun, DataAdapterRunDocument } from './schemas/data-adapter-run.schema';

const CRON_PREFIX = 'data-adapter:';
const VERSION_CONTROL_URL = process.env.VERSION_CONTROL_URL ?? 'http://localhost:3026';

/**
 * Owns adapter CRUD, run history, and the one thing the REST layer
 * shouldn't: keeping each adapter's cron job in sync with its `schedule`
 * field. `SchedulerRegistry` holds live `CronJob`s by name, so a
 * create/update/delete here is the only place a job is added or removed —
 * the controller never touches the registry directly.
 */
@Injectable()
export class AdaptersService implements OnModuleInit {
  private readonly logger = new Logger(AdaptersService.name);

  constructor(
    @InjectModel(DataAdapterConfig.name) private readonly adapters: Model<DataAdapterConfigDocument>,
    @InjectModel(DataAdapterRun.name) private readonly runs: Model<DataAdapterRunDocument>,
    private readonly connectors: ConnectorRegistry,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /** Re-registers every enabled, scheduled adapter's cron job on process start — `SchedulerRegistry` itself holds nothing across restarts. */
  async onModuleInit(): Promise<void> {
    const scheduled = await this.adapters.find({ enabled: true, schedule: { $exists: true, $ne: null } }).lean();
    for (const adapter of scheduled) {
      this.registerCronJob(String(adapter._id), adapter.schedule!);
    }
  }

  async create(dto: CreateAdapterDto) {
    const existing = await this.adapters.findOne({ name: dto.name }).lean();
    if (existing) throw new ConflictException(`Adapter "${dto.name}" existiert bereits.`);
    this.connectors.get(dto.type).validateConfig(dto.connectionConfig);

    const doc = await this.adapters.create(dto);
    if (dto.enabled && dto.schedule) {
      this.registerCronJob(String(doc._id), dto.schedule);
    }
    return doc.toObject();
  }

  async list() {
    return this.adapters.find().sort({ name: 1 }).lean();
  }

  async findOne(id: string) {
    const doc = await this.adapters.findById(id).lean();
    if (!doc) throw new NotFoundException(`Adapter "${id}" wurde nicht gefunden.`);
    return doc;
  }

  async update(id: string, dto: UpdateAdapterDto) {
    const existing = await this.findOne(id);
    const merged = { ...existing, ...dto };
    if (dto.type || dto.connectionConfig) {
      this.connectors.get(merged.type).validateConfig(merged.connectionConfig);
    }

    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'data-adapter',
      resourceKey: id,
      snapshot: existing,
    });

    const doc = await this.adapters.findByIdAndUpdate(id, dto, { new: true }).lean();
    this.unregisterCronJob(id);
    if (doc?.enabled && doc?.schedule) {
      this.registerCronJob(id, doc.schedule);
    }
    return doc;
  }

  async schedule(id: string, cronExpression: string | null) {
    await this.findOne(id);
    const doc = await this.adapters.findByIdAndUpdate(id, { schedule: cronExpression ?? undefined }, { new: true }).lean();
    this.unregisterCronJob(id);
    if (cronExpression && doc?.enabled) {
      this.registerCronJob(id, cronExpression);
    }
    return doc;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    this.unregisterCronJob(id);
    await this.adapters.findByIdAndDelete(id);
    await this.runs.deleteMany({ adapterId: new Types.ObjectId(id) });
  }

  /** Runs the adapter's stream right now (manual trigger — "einen Datenstream starten" — or a cron tick). */
  async triggerRun(id: string) {
    const adapter = await this.findOne(id);
    const run = await this.runs.create({ adapterId: adapter._id, status: 'running', startedAt: new Date() });

    try {
      const result = await this.connectors.get(adapter.type).run(adapter.connectionConfig);
      await this.runs.findByIdAndUpdate(run._id, {
        status: 'succeeded',
        finishedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runs.findByIdAndUpdate(run._id, { status: 'failed', finishedAt: new Date(), error: message });
      throw err;
    }
    return this.runs.findById(run._id).lean();
  }

  async listRuns(id: string) {
    await this.findOne(id);
    return this.runs.find({ adapterId: new Types.ObjectId(id) }).sort({ startedAt: -1 }).limit(100).lean();
  }

  private registerCronJob(id: string, cronExpression: string): void {
    const name = CRON_PREFIX + id;
    if (this.scheduler.doesExist('cron', name)) return;
    const job = new CronJob(cronExpression, () => {
      this.triggerRun(id).catch((err) => this.logger.warn(`Scheduled run for adapter ${id} failed: ${err instanceof Error ? err.message : err}`));
    });
    this.scheduler.addCronJob(name, job);
    job.start();
  }

  private unregisterCronJob(id: string): void {
    const name = CRON_PREFIX + id;
    if (this.scheduler.doesExist('cron', name)) {
      this.scheduler.deleteCronJob(name);
    }
  }
}
