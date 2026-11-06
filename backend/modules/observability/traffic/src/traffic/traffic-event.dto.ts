import { z } from 'zod';

export const trafficEventSchema = z.object({
  observedAt: z.coerce.date().optional(),
  direction: z.enum(['client', 'server']),
  protocol: z.enum(['http', 'https']),
  sourceService: z.string().trim().min(1).max(100),
  targetService: z.string().trim().min(1).max(100),
  method: z.string().trim().regex(/^[A-Z]{1,16}$/),
  path: z.string().trim().min(1).max(256),
  statusCode: z.number().int().min(100).max(599).optional(),
  requestBytes: z.number().int().nonnegative().optional(),
  responseBytes: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  correlationId: z.string().trim().min(1).max(100).optional(),
  errorCode: z.string().regex(/^[A-Z0-9_]{1,48}$/).optional(),
  errorDetail: z.string().max(512).optional(),
}).strict();

export type TrafficEventInput = z.infer<typeof trafficEventSchema>;

export const trafficListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(250).default(100),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  service: z.string().trim().min(1).max(100).optional(),
  statusCode: z.coerce.number().int().min(100).max(599).optional(),
});
