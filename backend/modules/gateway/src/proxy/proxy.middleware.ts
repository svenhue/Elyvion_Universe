import { randomUUID } from 'node:crypto';
import { verifyBearerToken } from '@elyvion/shared';
import axios from 'axios';
import type { NextFunction, Request, Response } from 'express';
import type { RegistryCacheService } from '../registry/registry-cache.service';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
]);

/** `{ moduleName: ['/sub/path', ...] }` — exact sub-paths reachable without a Bearer token (e.g. registration). */
export type PublicRouteAllowlist = Record<string, string[]>;

/**
 * Mounted at `app.use('/api', ...)`, so `req.url` has already had `/api`
 * stripped by Express. The first path segment is the target module name,
 * the rest is forwarded as-is to `{module.baseUrl}{module.routePrefix}`.
 * Every request here must carry a valid Bearer JWT, verified against the
 * Auth module's JWKS, EXCEPT the explicit entries in `publicRoutes` (a new
 * account has no token yet) — those still go through the same proxy path,
 * just without the auth check.
 */
export function createProxyMiddleware(
  registryCache: RegistryCacheService,
  authIssuerUrl: string,
  apiAudience?: string,
  publicRoutes: PublicRouteAllowlist = {},
) {
  return async function proxyMiddleware(req: Request, res: Response, _next: NextFunction) {
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();

    const [, moduleName, ...rest] = req.url.split('?')[0].split('/');
    const subPath = rest.length ? `/${rest.join('/')}` : '';

    const isPublic = (publicRoutes[moduleName] ?? []).includes(subPath);
    if (!isPublic) {
      try {
        await verifyBearerToken(req.headers.authorization, authIssuerUrl, apiAudience);
      } catch {
        res.status(401).json({ error: { statusCode: 401, message: 'Invalid or expired token' } });
        return;
      }
    }

    const module = registryCache.get(moduleName);
    if (!module) {
      res.status(502).json({
        error: { statusCode: 502, message: `Unknown or unregistered module "${moduleName}"` },
      });
      return;
    }

    const query = req.url.includes('?') ? `?${req.url.split('?')[1]}` : '';
    // routePrefix "/" means "mounted at baseUrl root" — normalize so we never
    // produce a double slash in front of subPath.
    const prefix = module.routePrefix === '/' ? '' : module.routePrefix;
    const targetUrl = `${module.baseUrl}${prefix}${subPath}${query}`;

    // `express.json()` (mounted ahead of this middleware) only parses
    // `application/json` bodies — anything else (multipart file uploads,
    // say) passes through untouched, leaving `req.body` empty and the raw
    // stream still unread. Forwarding `req.body` in that case would send
    // an empty JSON object with the ORIGINAL multipart content-type header
    // still attached, which upstream rejects as a truncated multipart body
    // ("Unexpected end of form") — so a non-JSON request streams `req`
    // itself through instead, byte for byte, content-length included.
    const contentType = req.headers['content-type'] ?? '';
    const isJsonBody = contentType.includes('application/json');
    const isStreamable = !isJsonBody && (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT');

    try {
      const upstream = await axios.request({
        url: targetUrl,
        method: req.method as never,
        data: isStreamable ? req : req.body,
        headers: {
          'content-type': contentType || 'application/json',
          ...(isStreamable && req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
          'x-correlation-id': correlationId,
          authorization: req.headers.authorization,
        },
        // Buffered as raw bytes, never auto-JSON-parsed — a response can be
        // binary (the `files` module streams a download back), and axios's
        // default `responseType: 'json'` would mangle anything that isn't.
        responseType: 'arraybuffer',
        validateStatus: () => true,
        timeout: 10_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      for (const [key, value] of Object.entries(upstream.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
          res.setHeader(key, value as string);
        }
      }
      res.status(upstream.status);
      const responseContentType = (upstream.headers['content-type'] as string | undefined) ?? '';
      if (responseContentType.includes('application/json')) {
        const body = upstream.data.length ? JSON.parse(upstream.data.toString('utf-8')) : null;
        res.json(body);
      } else {
        res.send(upstream.data);
      }
    } catch {
      res.status(502).json({
        error: { statusCode: 502, message: `Module "${moduleName}" is unreachable` },
      });
    }
  };
}
