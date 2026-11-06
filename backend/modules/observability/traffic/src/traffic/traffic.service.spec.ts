import { normalizePath, TrafficService } from './traffic.service';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'node:crypto';

describe('traffic metadata handling', () => {
  it('removes query values and normalizes likely identifiers in paths', () => {
    expect(normalizePath('/api/users/12345?token=secret')).toBe('/api/users/:id');
    expect(normalizePath('/api/items/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/items/:id');
  });

  it('does not record the ingestion request itself', async () => {
    const create = jest.fn();
    const service = new TrafficService({ trafficEvent: { create } } as unknown as PrismaService);
    await service.record({
      direction: 'server',
      protocol: 'http',
      sourceService: 'gateway',
      targetService: 'traffic',
      method: 'POST',
      path: '/internal/events?private=query',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('stores only normalized paths and sanitized error details', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new TrafficService({ trafficEvent: { create } } as unknown as PrismaService);
    await service.record({
      direction: 'client',
      protocol: 'https',
      sourceService: 'gateway',
      targetService: 'users',
      method: 'GET',
      path: '/users/123456?api_key=private',
      correlationId: 'private-correlation-value',
      errorCode: 'ECONNRESET',
      errorDetail: 'credential=private user@example.test',
    });
    const data = create.mock.calls[0][0].data;
    expect(data.path).toBe('/users/:id');
    expect(data.correlationId).toBe(createHash('sha256').update('private-correlation-value').digest('hex'));
    expect(data.errorCode).toBe('HTTP_CLIENT_ERROR');
    expect(data.errorDetail).toBe('HTTP request failed');
    expect(JSON.stringify(data)).not.toContain('private');
    expect(JSON.stringify(data)).not.toContain('user@example.test');
  });
});
