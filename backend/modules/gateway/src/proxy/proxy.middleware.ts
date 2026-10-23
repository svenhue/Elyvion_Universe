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

/**
 * Mounted at `app.use('/api', ...)`, so `req.url` has already had `/api`
 * stripped by Express. The first path segment is the target module name,
 * the rest is forwarded as-is to `{module.baseUrl}{module.routePrefix}`.
 * Every request here must carry a valid Bearer JWT, verified against the
 * Auth module's JWKS — public, unauthenticated traffic never reaches a
 * business module through the Gateway.
 */
export function createProxyMiddleware(registryCache: RegistryCacheService, authIssuerUrl: string) {
  return async function proxyMiddleware(req: Request, res: Response, _next: NextFunction) {
    const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();

    try {
      await verifyBearerToken(req.headers.authorization, authIssuerUrl);
    } catch {
      res.status(401).json({ error: { statusCode: 401, message: 'Invalid or expired token' } });
      return;
    }

    const [, moduleName, ...rest] = req.url.split('?')[0].split('/');
    const module = registryCache.get(moduleName);
    if (!module) {
      res.status(502).json({
        error: { statusCode: 502, message: `Unknown or unregistered module "${moduleName}"` },
      });
      return;
    }

    const subPath = rest.length ? `/${rest.join('/')}` : '';
    const query = req.url.includes('?') ? `?${req.url.split('?')[1]}` : '';
    // routePrefix "/" means "mounted at baseUrl root" — normalize so we never
    // produce a double slash in front of subPath.
    const prefix = module.routePrefix === '/' ? '' : module.routePrefix;
    const targetUrl = `${module.baseUrl}${prefix}${subPath}${query}`;

    try {
      const upstream = await axios.request({
        url: targetUrl,
        method: req.method as never,
        data: req.body,
        headers: {
          'content-type': req.headers['content-type'] ?? 'application/json',
          'x-correlation-id': correlationId,
          authorization: req.headers.authorization,
        },
        validateStatus: () => true,
        timeout: 10_000,
      });

      for (const [key, value] of Object.entries(upstream.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
          res.setHeader(key, value as string);
        }
      }
      res.status(upstream.status).json(upstream.data);
    } catch {
      res.status(502).json({
        error: { statusCode: 502, message: `Module "${moduleName}" is unreachable` },
      });
    }
  };
}
