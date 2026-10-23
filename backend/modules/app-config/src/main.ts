import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3012);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  await app.listen(port);
  console.log(`[app-config] listening on :${port}`);

  await registerModule({
    registryUrl,
    name: 'app-config',
    type: 'ts',
    baseUrl,
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });
}
bootstrap();
