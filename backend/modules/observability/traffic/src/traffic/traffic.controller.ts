import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { envelope, requireAuthorization } from '@elyvion/shared';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Request } from 'express';
import { trafficEventSchema, trafficListQuerySchema } from './traffic-event.dto';
import { TrafficService } from './traffic.service';

@Controller()
export class TrafficController {
  constructor(private readonly traffic: TrafficService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('internal/events')
  async ingest(@Headers('x-traffic-token') token: string | undefined, @Body() body: unknown) {
    if (!isValidIngestionToken(token)) {
      throw new UnauthorizedException('Invalid traffic ingestion credentials');
    }
    const parsed = trafficEventSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid traffic event metadata');
    await this.traffic.record(parsed.data);
    return envelope({ accepted: true });
  }

  @Get('events')
  async list(@Req() request: Request, @Query() query: Record<string, unknown>) {
    const tenantId = request.header('x-tenant-id');
    const adminTenantId = process.env.TRAFFIC_ADMIN_TENANT_ID;
    if (!adminTenantId?.trim()) {
      throw new ServiceUnavailableException('Traffic administration is not configured');
    }
    if (tenantId !== adminTenantId) {
      throw new UnauthorizedException('Traffic observability is unavailable for this tenant');
    }
    await requireAuthorization({
      authorization: request.header('authorization'),
      tenantId,
      action: 'observability.traffic.read',
      resource: {
        type: 'observability-traffic',
        id: 'events',
        attributes: { tenantId },
      },
      requestId: request.header('x-correlation-id'),
    });

    const parsed = trafficListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid traffic query');
    if (parsed.data.since && parsed.data.until && parsed.data.since > parsed.data.until) {
      throw new BadRequestException('since must be earlier than until');
    }

    return envelope(await this.traffic.list(parsed.data));
  }
}

function isValidIngestionToken(candidate: string | undefined): boolean {
  const tokenPath = process.env.TRAFFIC_INGEST_TOKEN_FILE;
  if (!tokenPath) return false;
  let expected: string;
  try {
    expected = readFileSync(tokenPath, 'utf8').trim();
  } catch {
    return false;
  }
  if (!candidate || !expected) return false;
  const actualBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
