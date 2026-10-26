import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3028);
  const moduleName = process.env.MODULE_NAME ?? 'files';
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const routePrefix = process.env.MODULE_ROUTE_PREFIX ?? '/';
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  await app.listen(port);
  console.log(`[${moduleName}] listening on :${port}`);

  await registerModule({
    registryUrl,
    name: moduleName,
    type: 'ts',
    baseUrl,
    routePrefix,
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });

  // No actions-engine registration — a multipart file upload isn't
  // expressible as a generic JSON action schema, and the download
  // endpoint streams a binary response, not an envelope. Callers (the
  // frontend, or another module needing an attachment) talk to this
  // module's REST endpoints directly through the Gateway.
}
bootstrap();
