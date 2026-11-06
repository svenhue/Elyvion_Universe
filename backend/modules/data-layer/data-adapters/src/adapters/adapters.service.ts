import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Model, Types } from 'mongoose';
import { recordVersion } from '@elyvion/shared';
import { ConnectorRegistry } from './connectors/connector-registry';
import { AdapterSecretScope, AdapterSecretBinding, SecretStoreClient } from './secret-store.client';
import { CreateAdapterDto, UpdateAdapterDto } from './dto/adapters.dto';
import { DataAdapterConfig, DataAdapterConfigDocument } from './schemas/data-adapter.schema';
import { DataAdapterDeployment, DataAdapterDeploymentDocument } from './schemas/data-adapter-deployment.schema';
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
    @InjectModel(DataAdapterDeployment.name) private readonly deployments: Model<DataAdapterDeploymentDocument>,
    @InjectModel(DataAdapterRun.name) private readonly runs: Model<DataAdapterRunDocument>,
    private readonly connectors: ConnectorRegistry,
    private readonly scheduler: SchedulerRegistry,
    private readonly secretStore: SecretStoreClient,
  ) {}

  /** Re-registers every enabled, scheduled adapter's cron job on process start — `SchedulerRegistry` itself holds nothing across restarts. */
  async onModuleInit(): Promise<void> {
    const runtimeEnvironmentId = process.env.DATA_ADAPTER_ENVIRONMENT_ID?.trim();
    if (!runtimeEnvironmentId) {
      throw new ServiceUnavailableException('Data Adapter runtime environment is not configured.');
    }

    const legacy = await this.adapters.findOne({
      $or: [
        { tenantId: { $exists: false } },
        { environmentId: { $exists: false } },
        { workspaceId: { $exists: false } },
        { ownerId: { $exists: false } },
      ],
    }).lean();
    if (legacy) {
      throw new ServiceUnavailableException(
        'Unscoped legacy data adapters must be explicitly migrated or removed before this service can start.',
      );
    }

    const adapters = await this.adapters.find({ environmentId: runtimeEnvironmentId })
      .select({ connectionConfig: 1 }).lean();
    if (adapters.some((adapter) => containsSecretField(adapter.connectionConfig))) {
      throw new ServiceUnavailableException(
        'Legacy inline adapter credentials must be migrated to the secret store before this service can start.',
      );
    }
    const scheduled = await this.adapters.find({
      environmentId: runtimeEnvironmentId,
      enabled: true,
      schedule: { $exists: true, $ne: null },
    }).lean();
    for (const adapter of scheduled) {
      this.registerCronJob(String(adapter._id), adapter.schedule!, adapter);
    }
  }

  async create(
    dto: CreateAdapterDto,
    scope: AdapterSecretScope & { ownerId: string; authorization?: string; requestId?: string },
  ) {
    assertNoInlineSecrets(dto.connectionConfig);
    const existing = await this.adapters.findOne({ ...scopeFields(scope), name: dto.name }).lean();
    if (existing) throw new ConflictException(`Adapter "${dto.name}" existiert bereits.`);
    this.connectors.get(dto.type).validateConfig(dto.connectionConfig);

    const doc = await this.adapters.create({
      ...scopeFields(scope),
      ownerId: scope.ownerId,
      name: dto.name,
      type: dto.type,
      description: dto.description,
      connectionConfig: dto.connectionConfig,
      secretReferences: [],
      schedule: dto.schedule,
      enabled: dto.enabled,
    });
    let bindings: AdapterSecretBinding[] = [];
    const adapterScope = { ...scope, adapterId: String(doc._id) };
    try {
      bindings = await this.secretStore.createReferences(
        adapterScope,
        dto.secrets,
        scope.authorization,
        scope.requestId,
      );
      doc.secretReferences = bindings;
      await doc.save();
    } catch (error) {
      await this.adapters.findByIdAndDelete(doc._id);
      if (bindings.length) {
        await this.secretStore.deleteReferences(adapterScope, bindings, scope.authorization, scope.requestId);
      }
      throw error;
    }
    if (dto.enabled && dto.schedule) {
      this.registerCronJob(String(doc._id), dto.schedule, doc);
    }
    return publicAdapter(doc.toObject());
  }

  async list(scope: AdapterSecretScope) {
    const items = await this.adapters.find(scopeFields(scope)).sort({ name: 1 }).lean();
    return items.map(publicAdapter);
  }

  async findOne(id: string, scope: AdapterSecretScope) {
    const doc = await this.adapters.findOne({ _id: id, ...scopeFields(scope) }).lean();
    if (!doc) throw new NotFoundException(`Adapter "${id}" wurde nicht gefunden.`);
    return publicAdapter(doc);
  }

  async update(id: string, dto: UpdateAdapterDto, scope: AdapterSecretScope) {
    if (dto.secrets?.length) {
      throw new BadRequestException('Secret values must be rotated through the secret management API.');
    }
    const existing = await this.findOne(id, scope);
    const merged = { ...existing, ...dto };
    if (dto.type || dto.connectionConfig) {
      assertNoInlineSecrets(merged.connectionConfig);
      this.connectors.get(merged.type).validateConfig(merged.connectionConfig);
    }

    void recordVersion({
      versionControlUrl: VERSION_CONTROL_URL,
      resourceType: 'data-adapter',
      resourceKey: id,
      snapshot: existing,
    });

    const { secrets: _secrets, ...safeDto } = dto;
    const doc = await this.adapters.findOneAndUpdate(
      { _id: id, ...scopeFields(scope) },
      safeDto,
      { new: true },
    ).lean();
    this.unregisterCronJob(id);
    if (doc?.enabled && doc?.schedule) {
      this.registerCronJob(id, doc.schedule, doc);
    }
    return doc ? publicAdapter(doc) : null;
  }

  async schedule(id: string, cronExpression: string | null, scope: AdapterSecretScope) {
    await this.findOne(id, scope);
    const doc = await this.adapters.findOneAndUpdate(
      { _id: id, ...scopeFields(scope) },
      { schedule: cronExpression ?? undefined },
      { new: true },
    ).lean();
    this.unregisterCronJob(id);
    if (cronExpression && doc?.enabled) {
      this.registerCronJob(id, cronExpression, doc);
    }
    return doc ? publicAdapter(doc) : null;
  }

  async deploy(
    targetAdapterId: string,
    targetScope: AdapterSecretScope,
    sourceScope: AdapterSecretScope,
    sourceAdapterId: string,
  ) {
    if (sourceScope.environmentId === targetScope.environmentId) {
      throw new BadRequestException('Adapter deployments require a different target environment.');
    }

    const source = await this.adapters.findOne({ _id: sourceAdapterId, ...scopeFields(sourceScope) }).lean();
    if (!source) throw new NotFoundException(`Adapter "${sourceAdapterId}" wurde nicht gefunden.`);
    const targetAdapter = await this.adapters.findOne({
      _id: targetAdapterId,
      ...scopeFields(targetScope),
    }).lean();
    if (!targetAdapter) throw new NotFoundException('The target-environment adapter was not found.');

    const sourceReferences = source.secretReferences ?? [];
    const targetReferences = targetAdapter.secretReferences ?? [];
    const expectedTargetPrefix =
      `vault://tenants/${encodeURIComponent(sourceScope.tenantId)}` +
      `/environments/${encodeURIComponent(targetScope.environmentId)}` +
      `/data-adapters/${encodeURIComponent(targetAdapterId)}/`;
    const sourceKeys = sourceReferences.map(({ configKey }) => configKey).sort();
    const targetKeys = targetReferences.map(({ configKey }) => configKey).sort();
    if (
      JSON.stringify(sourceKeys) !== JSON.stringify(targetKeys) ||
      targetReferences.some((reference) =>
        reference.status !== 'active' ||
        !reference.reference.startsWith(expectedTargetPrefix),
      )
    ) {
      throw new BadRequestException(
        'The target adapter must have active, target-environment secret references for every source credential key.',
      );
    }

    assertNoInlineSecrets(source.connectionConfig);
    this.connectors.get(source.type).validateConfig(source.connectionConfig);
    const manifest = {
      name: source.name,
      type: source.type,
      ...(source.description ? { description: source.description } : {}),
      connectionConfig: source.connectionConfig,
      secretReferences: targetReferences,
      ...(source.schedule ? { schedule: source.schedule } : {}),
      enabled: source.enabled,
    };
    const deployment = await this.deployments.create({
      tenantId: sourceScope.tenantId,
      sourceWorkspaceId: sourceScope.workspaceId,
      sourceEnvironmentId: sourceScope.environmentId,
      sourceAdapterId,
      targetWorkspaceId: targetScope.workspaceId,
      targetEnvironmentId: targetScope.environmentId,
      targetAdapterId,
      status: 'pending',
      manifest,
    });

    try {
      const updatedTarget = await this.adapters.findOneAndUpdate(
        { _id: targetAdapterId, ...scopeFields(targetScope) },
        {
          name: manifest.name,
          type: manifest.type,
          description: manifest.description,
          connectionConfig: manifest.connectionConfig,
          schedule: manifest.schedule,
          enabled: manifest.enabled,
        },
        { new: true },
      ).lean();
      if (!updatedTarget) throw new NotFoundException('The target-environment adapter was not found.');
      await this.deployments.updateOne(
        { _id: deployment._id, tenantId: sourceScope.tenantId },
        { status: 'deployed', deployedAt: new Date() },
      );
      this.unregisterCronJob(targetAdapterId);
      if (updatedTarget.enabled && updatedTarget.schedule) {
        this.registerCronJob(targetAdapterId, updatedTarget.schedule, updatedTarget);
      }
      return publicDeployment(deployment.toObject(), 'deployed');
    } catch (error) {
      await this.deployments.updateOne(
        { _id: deployment._id, tenantId: sourceScope.tenantId },
        { status: 'failed' },
      );
      throw error;
    }
  }

  async listDeployments(id: string, scope: AdapterSecretScope) {
    const target = await this.adapters.findOne({ _id: id, ...scopeFields(scope) }).select({ _id: 1 }).lean();
    if (!target) throw new NotFoundException(`Adapter "${id}" wurde nicht gefunden.`);
    const deployments = await this.deployments.find({
      tenantId: scope.tenantId,
      targetAdapterId: id,
      targetWorkspaceId: scope.workspaceId,
      targetEnvironmentId: scope.environmentId,
    }).sort({ createdAt: -1 }).lean();
    return deployments.map((deployment) => publicDeployment(deployment));
  }

  async remove(
    id: string,
    scope: AdapterSecretScope,
    authorization?: string,
    requestId?: string,
  ): Promise<void> {
    const adapter = await this.findOne(id, scope);
    if (adapter.secretReferences.length) {
      await this.secretStore.deleteReferences(
        { ...scope, adapterId: id },
        adapter.secretReferences,
        authorization,
        requestId,
      );
    }
    this.unregisterCronJob(id);
    await this.adapters.findOneAndDelete({ _id: id, ...scopeFields(scope) });
    await this.runs.deleteMany({ adapterId: new Types.ObjectId(id), ...scopeFields(scope) });
  }

  /** Runs the adapter's stream right now (manual trigger — "einen Datenstream starten" — or a cron tick). */
  async triggerRun(id: string, scope: AdapterSecretScope, requestId?: string) {
    const adapter = await this.adapters.findOne({ _id: id, ...scopeFields(scope) }).lean();
    if (!adapter) throw new NotFoundException(`Adapter "${id}" wurde nicht gefunden.`);
    const run = await this.runs.create({
      adapterId: adapter._id,
      ...scopeFields(scope),
      status: 'running',
      startedAt: new Date(),
    });

    try {
      const runtimeConfig = await this.resolveRuntimeConfig(adapter, scope, requestId);
      const result = await this.connectors.get(adapter.type).run(runtimeConfig);
      await this.runs.findByIdAndUpdate(run._id, {
        status: 'succeeded',
        finishedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
      });
    } catch (err) {
      await this.runs.findByIdAndUpdate(run._id, {
        status: 'failed',
        finishedAt: new Date(),
        error: 'Adapter run failed; check the sanitized server log.',
      });
      this.logger.warn(`Data adapter run failed for adapter ${id}.`);
      throw new ServiceUnavailableException('Data adapter run failed.');
    }
    return this.runs.findById(run._id).lean();
  }

  async listRuns(id: string, scope: AdapterSecretScope) {
    await this.findOne(id, scope);
    return this.runs.find({ adapterId: new Types.ObjectId(id), ...scopeFields(scope) })
      .sort({ startedAt: -1 }).limit(100).lean();
  }

  private async resolveRuntimeConfig(
    adapter: DataAdapterConfig & { _id: Types.ObjectId },
    scope: AdapterSecretScope,
    requestId?: string,
  ): Promise<Record<string, unknown>> {
    const runtimeConfig = structuredClone(adapter.connectionConfig);
    for (const binding of adapter.secretReferences ?? []) {
      const value = await this.secretStore.resolveReference(binding.reference, {
        ...scope,
        adapterId: String(adapter._id),
      }, requestId);
      setNestedValue(runtimeConfig, binding.configKey, value);
    }
    return runtimeConfig;
  }

  private registerCronJob(
    id: string,
    cronExpression: string,
    adapter: Pick<DataAdapterConfig, 'tenantId' | 'environmentId' | 'workspaceId'>,
  ): void {
    const name = CRON_PREFIX + id;
    if (this.scheduler.doesExist('cron', name)) return;
    const job = new CronJob(cronExpression, () => {
      const scope = {
        tenantId: adapter.tenantId,
        environmentId: adapter.environmentId,
        workspaceId: adapter.workspaceId,
        adapterId: id,
      };
      this.triggerRun(id, scope).catch(() => this.logger.warn(`Scheduled run failed for adapter ${id}.`));
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

function scopeFields(scope: AdapterSecretScope) {
  return {
    tenantId: scope.tenantId,
    environmentId: scope.environmentId,
    workspaceId: scope.workspaceId,
  };
}

function publicAdapter<T extends object>(adapter: T): T & { secretReferences: unknown[] } {
  const record = adapter as T & { secretReferences?: unknown[] };
  return { ...adapter, secretReferences: record.secretReferences ?? [] };
}

function publicDeployment<T extends object>(deployment: T, status?: 'deployed') {
  const { manifest: _manifest, ...metadata } = deployment as T & { manifest?: unknown };
  return {
    ...metadata,
    ...(status ? { status } : {}),
  };
}

function containsSecretField(value: unknown): boolean {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      if (parsed.username || parsed.password) return true;
    } catch {
      return false;
    }
    return false;
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsSecretField);
  return Object.entries(value).some(([key, item]) =>
    /password|secret|token|api.?key|private.?key|credential|authorization|^user(name)?$|^value$/i.test(key) ||
    containsSecretField(item),
  );
}

function assertNoInlineSecrets(config: Record<string, unknown>): void {
  if (containsSecretField(config)) {
    throw new BadRequestException(
      'Sensitive values must be submitted separately as secrets and may not be placed in connectionConfig.',
    );
  }
}

function setNestedValue(config: Record<string, unknown>, configKey: string, value: string): void {
  const segments = configKey.split('.');
  let current = config;
  for (const segment of segments.slice(0, -1)) {
    const child = current[segment];
    if (child === undefined) current[segment] = {};
    if (!current[segment] || typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
      throw new BadRequestException('Secret config path conflicts with adapter configuration.');
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}
