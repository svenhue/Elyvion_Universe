import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTargetDto } from './dto/health.dto';

interface RegistryModule {
  name: string;
  healthCheckUrl: string;
}

/**
 * Generic health tracking: anything with a URL to ping is a target,
 * whether that's a backend module (auto-discovered from the Registry —
 * which only ever keeps the latest status, not history) or a deployment
 * (registered by deployment-engine once it starts a container). Two
 * independent cron ticks: one keeps the target list in sync with the
 * Registry, the other pings every known target and records the result.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  constructor(private readonly prisma: PrismaService) {}

  async registerTarget(dto: RegisterTargetDto) {
    return this.prisma.healthTarget.upsert({
      where: { name: dto.name },
      create: dto,
      update: { url: dto.url, source: dto.source, checkIntervalSeconds: dto.checkIntervalSeconds },
    });
  }

  async removeTarget(name: string): Promise<void> {
    const target = await this.prisma.healthTarget.findUnique({ where: { name } });
    if (!target) throw new NotFoundException(`Target "${name}" wurde nicht gefunden.`);
    await this.prisma.healthTarget.delete({ where: { name } });
  }

  /** Every target with its most recent result — the "is everything up" overview. */
  async getStatus() {
    const targets = await this.prisma.healthTarget.findMany({
      include: { results: { orderBy: { checkedAt: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    return targets.map((target) => ({
      id: target.id,
      name: target.name,
      url: target.url,
      source: target.source,
      latest: target.results[0] ?? null,
    }));
  }

  async getHistory(targetId: string, limit: number) {
    const target = await this.prisma.healthTarget.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException(`Target "${targetId}" wurde nicht gefunden.`);
    return this.prisma.healthCheckResult.findMany({
      where: { targetId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
  }

  /** Keeps the target list in sync with whatever modules the Registry currently knows about. */
  @Cron(CronExpression.EVERY_MINUTE)
  async syncRegistryModules(): Promise<void> {
    try {
      const response = await axios.get<{ data: RegistryModule[] }>(`${this.registryUrl}/modules`, { timeout: 5000 });
      for (const module of response.data.data) {
        await this.prisma.healthTarget.upsert({
          where: { name: module.name },
          create: { name: module.name, url: module.healthCheckUrl, source: 'registry_module' },
          update: { url: module.healthCheckUrl },
        });
      }
    } catch (err) {
      this.logger.warn(`Could not sync modules from Registry: ${err instanceof Error ? err.message : err}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pingAllTargets(): Promise<void> {
    const targets = await this.prisma.healthTarget.findMany();
    await Promise.all(targets.map((target) => this.pingTarget(target.id, target.url)));
  }

  private async pingTarget(targetId: string, url: string): Promise<void> {
    const startedAt = Date.now();
    try {
      await axios.get(url, { timeout: 5000 });
      await this.prisma.healthCheckResult.create({
        data: { targetId, status: 'up', responseTimeMs: Date.now() - startedAt },
      });
    } catch (err) {
      await this.prisma.healthCheckResult.create({
        data: {
          targetId,
          status: 'down',
          responseTimeMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}
