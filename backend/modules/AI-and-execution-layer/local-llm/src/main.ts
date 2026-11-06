import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3028);
  const moduleName = process.env.MODULE_NAME ?? 'local-llm';
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();
  await app.listen(port);
  await registerModule({
    registryUrl,
    name: moduleName,
    type: 'ts',
    baseUrl,
    routePrefix: '/',
    healthCheckUrl: `${baseUrl}/health`,
    version: '0.1.0',
  });
}

void bootstrap();
