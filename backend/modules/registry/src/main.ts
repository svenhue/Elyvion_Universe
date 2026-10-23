import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  const port = Number(process.env.PORT ?? 3010);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  await app.listen(port);
  console.log(`[registry] listening on :${port}`);

  // Self-registration (with itself) so /api/registry/... is routable
  // through the Gateway like any other module — e.g. for the admin UI.
  await registerModule({
    registryUrl: baseUrl,
    name: 'registry',
    type: 'ts',
    baseUrl,
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });
}
bootstrap();
