import { NestFactory } from '@nestjs/core';
import {
  ElyvionExceptionFilter,
  registerModule,
  registerPermission,
  registerRemoteAction,
  registerResource,
} from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3019);
  const moduleName = process.env.MODULE_NAME ?? 'data-adapters';
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const routePrefix = process.env.MODULE_ROUTE_PREFIX ?? '/';
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const actionsEngineUrl = process.env.ACTIONS_ENGINE_URL ?? 'http://localhost:3015';
  const securityUrl = process.env.SECURITY_URL ?? 'http://localhost:3022';

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

  // Self-registers this module as a `security` Resource and its sensitive
  // actions' permissions under it ("jedes Modul muss exposen, welche
  // Berechtigung es hat, unter seiner Ressourcengruppe, und dann jeweils
  // den Aktionen zuweisen") — a working example of the full pattern, see
  // security/README.md for which other modules still need this.
  await registerResource({ securityUrl, key: moduleName, name: 'Data-Adapters' });
  for (const [key, name] of [
    ['data.adapter.create', 'Create data adapter'],
    ['data.adapter.read', 'Read data adapters'],
    ['data.adapter.update', 'Update data adapters'],
    ['data.adapter.delete', 'Delete data adapters'],
    ['data.adapter.test', 'Test data adapters'],
    ['data.adapter.deploy', 'Deploy data adapters'],
    ['data.adapter.secret.configure', 'Configure adapter secret references'],
  ] as const) {
    await registerPermission({ securityUrl, resourceKey: moduleName, key, name });
  }

  // Exposes "start a data stream" / "schedule a cronjob" as actions, so
  // workflows and agents can drive data adapters the same way a person
  // would from the Data-Adapters page — see README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_data_adapters',
    name: 'Daten-Adapter auflisten',
    description: 'Listet alle konfigurierten Daten-Adapter.',
    category: 'data-adapters',
    path: '/adapters',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_data_adapter',
    name: 'Daten-Adapter anlegen',
    description: 'Legt einen neuen Daten-Adapter an (type: http | file | jdbc | sap, connectionConfig je Typ, optional ein Cron-Schedule).',
    category: 'data-adapters',
    path: '/adapters',
    method: 'POST',
    requiredPermission: `${moduleName}:data.adapter.create`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['http', 'file', 'jdbc', 'sap'] },
        description: { type: 'string' },
        connectionConfig: { type: 'object' },
        secrets: { type: 'array', items: { type: 'object' } },
        schedule: { type: 'string' },
        enabled: { type: 'boolean' },
      },
      required: ['name', 'type', 'connectionConfig'],
    },
  });
  await register({
    key: 'delete_data_adapter',
    name: 'Daten-Adapter löschen',
    description: 'Löscht einen Daten-Adapter samt Lauf-Historie.',
    category: 'data-adapters',
    path: '/adapters/{id}',
    method: 'DELETE',
    requiredPermission: `${moduleName}:data.adapter.delete`,
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
  await register({
    key: 'start_data_stream',
    name: 'Datenstream starten',
    description: 'Führt den Datenadapter sofort einmal aus und liefert das Lauf-Ergebnis.',
    category: 'data-adapters',
    path: '/adapters/{id}/runs',
    method: 'POST',
    requiredPermission: `${moduleName}:data.adapter.test`,
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
  await register({
    key: 'schedule_data_adapter',
    name: 'Daten-Adapter zeitsteuern',
    description: 'Setzt (oder entfernt mit schedule=null) den Cron-Zeitplan eines Adapters.',
    category: 'data-adapters',
    path: '/adapters/{id}/schedule',
    method: 'PATCH',
    requiredPermission: `${moduleName}:data.adapter.update`,
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, schedule: { type: 'string' } },
      required: ['id', 'schedule'],
    },
  });
  await register({
    key: 'list_data_adapter_runs',
    name: 'Adapter-Läufe auflisten',
    description: 'Zeigt die letzten Ausführungen eines Daten-Adapters.',
    category: 'data-adapters',
    path: '/adapters/{id}/runs',
    method: 'GET',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
}
bootstrap();
