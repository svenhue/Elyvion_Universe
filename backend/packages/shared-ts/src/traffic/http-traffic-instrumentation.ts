import { channel } from 'node:diagnostics_channel';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';

interface HttpRequest {
  method?: string;
  url?: string;
  path?: string;
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { encrypted?: boolean };
  getHeader?: (name: string) => string | number | string[] | undefined;
  host?: string;
}

interface HttpResponse {
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
  getHeader?: (name: string) => string | number | string[] | undefined;
}

interface HttpMessage {
  request?: HttpRequest;
  response?: HttpResponse;
  error?: { code?: string };
}

interface TrafficEvent {
  direction: 'client' | 'server';
  protocol: 'http' | 'https';
  sourceService: string;
  targetService: string;
  method: string;
  path: string;
  statusCode?: number;
  requestBytes?: number;
  responseBytes?: number;
  durationMs?: number;
  correlationId?: string;
  errorCode?: string;
  errorDetail?: string;
}

const startTimes = new WeakMap<object, number>();
const installedModules = new Set<string>();
let missingConfigWarningShown = false;
let deliveryWarningShown = false;
let ingestionConfig: { endpoint: string; token: string } | null | undefined;

export function installHttpTrafficInstrumentation(moduleName: string): void {
  if (installedModules.has(moduleName)) return;
  installedModules.add(moduleName);
  loadIngestionConfig();

  subscribeHttpChannel('http.client.request.start', (message) => {
    if (message.request) startTimes.set(message.request, Date.now());
  });
  subscribeHttpChannel('http.client.response.finish', (message) => {
    if (!message.request || !message.response) return;
    publish(createClientEvent(message, moduleName));
  });
  subscribeHttpChannel('http.client.request.error', (message) => {
    if (!message.request) return;
    publish(createClientEvent(message, moduleName, message.error?.code ?? 'HTTP_CLIENT_ERROR'));
  });
  subscribeHttpChannel('http.server.request.start', (message) => {
    if (message.request) startTimes.set(message.request, Date.now());
  });
  subscribeHttpChannel('http.server.response.finish', (message) => {
    if (!message.request || !message.response) return;
    publish(createServerEvent(message, moduleName));
  });
}

function subscribeHttpChannel(name: string, listener: (message: HttpMessage) => void): void {
  channel(name).subscribe((value: unknown) => {
    const message = toHttpMessage(value);
    if (message) listener(message);
  });
}

function toHttpMessage(value: unknown): HttpMessage | undefined {
  if (!isRecord(value) || !isRecord(value['request'])) return undefined;
  const rawRequest = value['request'];
  const rawResponse = value['response'];
  const rawError = value['error'];
  return {
    request: rawRequest as HttpRequest,
    ...(isRecord(rawResponse) ? { response: rawResponse as HttpResponse } : {}),
    ...(isRecord(rawError) ? { error: rawError as { code?: string } } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createClientEvent(message: HttpMessage, moduleName: string, errorCode?: string): TrafficEvent {
  const request = message.request!;
  const response = message.response;
  const host = header(request, 'host') ?? request.host ?? 'unknown';
  const path = request.path ?? request.url ?? '/';
  return {
    direction: 'client',
    protocol: request.protocol === 'https:' ? 'https' : 'http',
    sourceService: moduleName,
    targetService: normalizeServiceName(header(request, 'x-elyvion-target-service') ?? host),
    method: normalizeMethod(request.method),
    path: normalizePath(path),
    ...(isStatusCode(response?.statusCode) ? { statusCode: response.statusCode } : {}),
    ...byteCount(header(request, 'content-length'), 'requestBytes'),
    ...byteCount(responseHeader(response, 'content-length'), 'responseBytes'),
    ...duration(request),
    ...correlationId(request),
    ...(errorCode ? {
      errorCode: normalizeErrorCode(errorCode),
      errorDetail: response?.statusCode && response.statusCode >= 500
        ? `HTTP response status ${response.statusCode}`
        : 'HTTP request failed',
    } : {}),
  };
}

function createServerEvent(message: HttpMessage, moduleName: string): TrafficEvent {
  const request = message.request!;
  const response = message.response!;
  const clientService = header(request, 'x-elyvion-source-service');
  return {
    direction: 'server',
    protocol: request.socket?.encrypted ? 'https' : 'http',
    sourceService: clientService && /^[a-z0-9-]{1,60}$/i.test(clientService) ? clientService : 'external',
    targetService: moduleName,
    method: normalizeMethod(request.method),
    path: normalizePath(request.url ?? '/'),
    ...(isStatusCode(response.statusCode) ? { statusCode: response.statusCode } : {}),
    ...byteCount(header(request, 'content-length'), 'requestBytes'),
    ...byteCount(response.getHeader?.('content-length'), 'responseBytes'),
    ...duration(request),
    ...correlationId(request),
    ...(response.statusCode && response.statusCode >= 500 ? {
      errorCode: `HTTP_${response.statusCode}`,
      errorDetail: `HTTP response status ${response.statusCode}`,
    } : {}),
  };
}

function publish(event: TrafficEvent): void {
  const config = ingestionConfig;
  if (!config) return;
  if (normalizePath(event.path) === '/internal/events') return;

  try {
    const endpointUrl = new URL(config.endpoint);
    if (
      !['http:', 'https:'].includes(endpointUrl.protocol) ||
      endpointUrl.pathname !== '/internal/events' ||
      endpointUrl.username ||
      endpointUrl.password ||
      endpointUrl.search ||
      endpointUrl.hash ||
      (process.env.NODE_ENV === 'production' && endpointUrl.protocol !== 'https:')
    ) {
      throw new Error('Invalid traffic ingestion URL');
    }
  } catch {
    if (!deliveryWarningShown) {
      deliveryWarningShown = true;
      console.warn('[traffic] event delivery disabled: ingestion URL is invalid');
    }
    return;
  }
  void fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-traffic-token': config.token,
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(2000),
  }).then((response) => {
    if (!response.ok && !deliveryWarningShown) {
      deliveryWarningShown = true;
      console.warn(`[traffic] event delivery rejected with status ${response.status}`);
    }
  }).catch(() => {
    if (!deliveryWarningShown) {
      deliveryWarningShown = true;
      console.warn('[traffic] event delivery failed');
    }
  });
}

function loadIngestionConfig(): void {
  if (ingestionConfig !== undefined) return;
  const endpoint = process.env.TRAFFIC_INGEST_URL ?? 'http://localhost:3025/internal/events';
  const tokenFile = process.env.TRAFFIC_INGEST_TOKEN_FILE ?? '/run/secrets/traffic_ingest_token';
  try {
    const token = readFileSync(tokenFile, 'utf8').trim();
    ingestionConfig = token ? { endpoint, token } : null;
  } catch {
    ingestionConfig = null;
  }
  if (!ingestionConfig && !missingConfigWarningShown) {
    missingConfigWarningShown = true;
    console.warn('[traffic] event delivery disabled: ingestion token file is unavailable');
  }
}

function header(request: HttpRequest, name: string): string | undefined {
  const value = request.headers?.[name] ?? request.getHeader?.(name);
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function responseHeader(response: HttpResponse | undefined, name: string): string | undefined {
  const value = response?.headers?.[name] ?? response?.getHeader?.(name);
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function byteCount(value: unknown, key: 'requestBytes' | 'responseBytes'): Partial<TrafficEvent> {
  const bytes = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? { [key]: bytes } : {};
}

function duration(request: HttpRequest): Partial<TrafficEvent> {
  const startedAt = startTimes.get(request);
  return startedAt ? { durationMs: Math.max(0, Date.now() - startedAt) } : {};
}

function correlationId(request: HttpRequest): Partial<TrafficEvent> {
  const value = header(request, 'x-correlation-id');
  return value && value.length <= 100 && /^[\w.-]+$/.test(value)
    ? { correlationId: value }
    : {};
}

function normalizeMethod(value: string | undefined): string {
  return value && /^[A-Z]{1,16}$/i.test(value) ? value.toUpperCase() : 'UNKNOWN';
}

function normalizeServiceName(host: string): string {
  const hostname = host.toLowerCase().split(':')[0].replace(/[^a-z0-9.-]/g, '').slice(0, 100);
  return hostname && !isIP(hostname) ? hostname : 'external';
}

function normalizePath(value: string): string {
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
    if (/^\d{4,}$/.test(decoded) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded)) return ':id';
    if (decoded.length >= 16 || decoded.includes('@')) return '[REDACTED]';
    return decoded.replace(/[\r\n]/g, '');
  }).join('/').slice(0, 256) || '/';
}

function normalizeErrorCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 48) || 'HTTP_CLIENT_ERROR';
}

function isStatusCode(value: number | undefined): value is number {
  return Number.isInteger(value) && value! >= 100 && value! <= 599;
}
