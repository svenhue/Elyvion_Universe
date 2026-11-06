import { createHash } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrafficEventInput } from './traffic-event.dto';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_RETENTION_DAYS = 30;

@Injectable()
export class TrafficService implements OnModuleInit {
  private readonly logger = new Logger(TrafficService.name);
  private readonly retentionDays = readRetentionDays();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.deleteExpiredEvents();
  }

  async record(input: TrafficEventInput): Promise<void> {
    const path = normalizePath(input.path);
    if (path === '/internal/events') return;

    const errorCode = input.statusCode && input.statusCode >= 500
      ? `HTTP_${input.statusCode}`
      : input.errorCode
        ? 'HTTP_CLIENT_ERROR'
        : undefined;
    await this.prisma.trafficEvent.create({
      data: {
        direction: input.direction,
        protocol: input.protocol,
        sourceService: input.sourceService,
        targetService: input.targetService,
        method: input.method,
        path,
        statusCode: input.statusCode,
        requestBytes: input.requestBytes,
        responseBytes: input.responseBytes,
        durationMs: input.durationMs,
        ...(input.correlationId
          ? { correlationId: createHash('sha256').update(input.correlationId).digest('hex') }
          : {}),
        ...(errorCode ? {
          errorCode,
          errorDetail: input.statusCode && input.statusCode >= 500
            ? `HTTP response status ${input.statusCode}`
            : 'HTTP request failed',
        } : {}),
      },
    });
  }

  list(input: {
    limit: number;
    offset: number;
    since?: Date;
    until?: Date;
    service?: string;
    statusCode?: number;
  }) {
    const where = {
      observedAt: {
        ...(input.since ? { gte: input.since } : {}),
        ...(input.until ? { lte: input.until } : {}),
      },
      ...(input.service ? {
        OR: [
          { sourceService: input.service },
          { targetService: input.service },
        ],
      } : {}),
      ...(input.statusCode ? { statusCode: input.statusCode } : {}),
    };
    return this.prisma.trafficEvent.findMany({
      where,
      select: {
        id: true,
        observedAt: true,
        direction: true,
        protocol: true,
        sourceService: true,
        targetService: true,
        method: true,
        path: true,
        statusCode: true,
        requestBytes: true,
        responseBytes: true,
        durationMs: true,
        correlationId: true,
        errorCode: true,
        errorDetail: true,
      },
      orderBy: { observedAt: 'desc' },
      take: input.limit,
      skip: input.offset,
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deleteExpiredEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.trafficEvent.deleteMany({
      where: { observedAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`Deleted ${result.count} expired traffic events.`);
    }
  }
}

export function normalizePath(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0] || '/';
  const segments = withoutQuery.split('/');
  return segments.map((segment, index) => {
      if (!segment) return '';
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return '[REDACTED]';
      }
      if (index > 0 && /^(token|secret|password|credential|api[-_]?key|authorization)$/i.test(segments[index - 1])) {
        return '[REDACTED]';
      }
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded) || /^\d{4,}$/.test(decoded)) return ':id';
      if (decoded.length >= 16 || /@/.test(decoded)) return '[REDACTED]';
      return decoded.replace(/[\r\n]/g, '');
    })
    .join('/')
    .slice(0, 256) || '/';
}

function readRetentionDays(): number {
  const configured = Number(process.env.TRAFFIC_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(configured) || configured < 1 || configured > 365) {
    throw new Error('TRAFFIC_RETENTION_DAYS must be between 1 and 365.');
  }
  return configured;
}
