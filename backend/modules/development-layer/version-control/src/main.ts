import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3026);
  const moduleName = process.env.MODULE_NAME ?? 'version-control';
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const routePrefix = process.env.MODULE_ROUTE_PREFIX ?? '/';
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const actionsEngineUrl = process.env.ACTIONS_ENGINE_URL ?? 'http://localhost:3015';

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

  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'get_object_history',
    name: 'Änderungsverlauf abrufen',
    description: 'Zeigt alle gespeicherten Versionen eines Objekts (resourceType, resourceKey) — Change-Management-Historie.',
    category: 'version-control',
    path: '/versions/{resourceType}/{resourceKey}/history',
    method: 'GET',
    inputSchema: {
      type: 'object',
      properties: { resourceType: { type: 'string' }, resourceKey: { type: 'string' } },
      required: ['resourceType', 'resourceKey'],
    },
  });
}
bootstrap();
