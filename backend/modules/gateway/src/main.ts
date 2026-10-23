import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import * as express from 'express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RegistryCacheService } from './registry/registry-cache.service';
import { createProxyMiddleware, PublicRouteAllowlist } from './proxy/proxy.middleware';

// New accounts have no token yet — these are the only /api/{module}{path}
// combinations reachable without a Bearer JWT. Keep this list short and
// explicit; everything else stays behind auth by default.
const PUBLIC_ROUTES: PublicRouteAllowlist = {
  users: ['/register'],
};

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const authIssuerUrl = process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011';
  const apiAudience = process.env.API_AUDIENCE ?? 'elyvion:api';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  const registryCache = app.get(RegistryCacheService);
  // Our own body parser, scoped to /api — don't rely on Nest's own
  // (platform-express) body-parser having already run for raw app.use()
  // middleware registered this early in the bootstrap sequence.
  app.use(
    '/api',
    express.json(),
    createProxyMiddleware(registryCache, authIssuerUrl, apiAudience, PUBLIC_ROUTES),
  );

  await app.listen(port);
  console.log(`[gateway] listening on :${port}`);

  await registerModule({
    registryUrl,
    name: 'gateway',
    type: 'ts',
    baseUrl,
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });
}
bootstrap();
