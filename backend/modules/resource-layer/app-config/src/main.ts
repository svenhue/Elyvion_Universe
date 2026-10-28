import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3012);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const actionsEngineUrl = process.env.ACTIONS_ENGINE_URL ?? 'http://localhost:3015';

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

  // Exposes this module's own capabilities as actions — usable by
  // workflows and by agent-engine's agents, the same way any module can
  // (see @elyvion/shared's registerRemoteAction). Reusing GET
  // /configs/:applicationId as get_app_schema needs no new endpoint; the
  // other two call the new elements endpoints this commit adds.
  await registerRemoteAction({
    actionsEngineUrl,
    key: 'get_app_schema',
    name: 'App-Konfiguration lesen',
    description: 'Liest die vollständige Schema-Konfiguration einer Pro-Code-Anwendung.',
    category: 'app-config',
    moduleName: 'app-config',
    path: '/configs/{applicationId}',
    method: 'GET',
    inputSchema: {
      type: 'object',
      properties: { applicationId: { type: 'string' } },
      required: ['applicationId'],
    },
  });
  await registerRemoteAction({
    actionsEngineUrl,
    key: 'add_element',
    name: 'Element hinzufügen',
    description: 'Fügt einer Pro-Code-Anwendung ein neues Element als Kind eines bestehenden Elements hinzu.',
    category: 'app-config',
    moduleName: 'app-config',
    path: '/configs/{applicationId}/elements',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        applicationId: { type: 'string' },
        parentId: { type: 'string', description: 'Id des Eltern-Elements, dem das neue Element als Kind hinzugefügt wird.' },
        element: { type: 'object', description: 'Das neue ComponentNode-Objekt (id, type, element/name/text, attributes, …).' },
      },
      required: ['applicationId', 'parentId', 'element'],
    },
  });
  await registerRemoteAction({
    actionsEngineUrl,
    key: 'update_element',
    name: 'Element bearbeiten',
    description: 'Ändert Felder (inkl. attributes, die zusammengeführt statt ersetzt werden) eines bestehenden Elements.',
    category: 'app-config',
    moduleName: 'app-config',
    path: '/configs/{applicationId}/elements/{elementId}',
    method: 'PATCH',
    inputSchema: {
      type: 'object',
      properties: {
        applicationId: { type: 'string' },
        elementId: { type: 'string' },
        patch: { type: 'object', description: 'Zu ändernde Felder des Elements.' },
      },
      required: ['applicationId', 'elementId', 'patch'],
    },
  });
}
bootstrap();
