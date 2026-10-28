import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3020);
  const moduleName = process.env.MODULE_NAME ?? 'telemetry';
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
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
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });

  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'get_system_health',
    name: 'System-Health abrufen',
    description: 'Zeigt jedes bekannte Ziel (Backend-Module und Deployments) mit seinem letzten Health-Check-Ergebnis.',
    category: 'telemetry',
    path: '/health/status',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'get_target_health_history',
    name: 'Health-Historie abrufen',
    description: 'Zeigt die letzten Health-Check-Ergebnisse eines einzelnen Ziels.',
    category: 'telemetry',
    path: '/health/targets/{id}/history',
    method: 'GET',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
}
bootstrap();
