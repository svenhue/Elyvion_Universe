import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RegistryCacheService } from './registry/registry-cache.service';
import { createProxyMiddleware } from './proxy/proxy.middleware';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const authIssuerUrl = process.env.AUTH_ISSUER_URL ?? 'http://localhost:3011';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  const registryCache = app.get(RegistryCacheService);
  app.use('/api', createProxyMiddleware(registryCache, authIssuerUrl));

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
