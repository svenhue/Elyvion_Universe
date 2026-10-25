import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3027);
  const moduleName = process.env.MODULE_NAME ?? 'repository';
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

  // Exposes Repository management as actions — "ein Repository kann aus
  // Workflow-Definition, Entitätsdefinition, Anwendungsdefinition,
  // Aktionsdefinition oder Logik bestehen" — see README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_repositories',
    name: 'Repositories auflisten',
    description: 'Listet alle Repositories (kuratierte Bündel aus Workflow-/Entitäts-/Anwendungs-/Aktions-/Regel-Definitionen) mit ihren Mitgliedern.',
    category: 'repository',
    path: '/repositories',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_repository',
    name: 'Repository anlegen',
    description: 'Legt ein neues, leeres Repository an (key, name, optional description).',
    category: 'repository',
    path: '/repositories',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } },
      required: ['key', 'name'],
    },
  });
  await register({
    key: 'add_repository_member',
    name: 'Repository-Mitglied hinzufügen',
    description: 'Fügt einem Repository eine Definition hinzu (resourceType, resourceKey) — direkt angelegt oder als Kopie einer anderen Ressource.',
    category: 'repository',
    path: '/repositories/{key}/members',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key des Ziel-Repositories.' },
        resourceType: {
          type: 'string',
          enum: ['application', 'workflow', 'agent', 'knowledge_graph', 'entity', 'action', 'rule', 'repository', 'solution'],
        },
        resourceKey: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['key', 'resourceType', 'resourceKey'],
    },
  });
  await register({
    key: 'remove_repository_member',
    name: 'Repository-Mitglied entfernen',
    description: 'Entfernt ein Mitglied aus einem Repository.',
    category: 'repository',
    path: '/repositories/{key}/members/{resourceType}/{resourceKey}',
    method: 'DELETE',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, resourceType: { type: 'string' }, resourceKey: { type: 'string' } },
      required: ['key', 'resourceType', 'resourceKey'],
    },
  });
}
bootstrap();
