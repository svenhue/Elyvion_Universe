import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3023);
  const moduleName = process.env.MODULE_NAME ?? 'solutions';
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

  // Exposes Solution management as actions — "ich muss im Endeffekt
  // Ressourcen erstellen können [die] aus beliebig vielen Apps,
  // Workflows, AI-Agents bestehen [und die] ich dann gesamthaft... unter
  // ein Deployment deployen [kann]" — see README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_solutions',
    name: 'Solutions auflisten',
    description: 'Listet alle Solutions (Bündel aus Apps, Workflows, Agents, Wissensgraphen, Entitäten) mit ihren Mitgliedern.',
    category: 'solutions',
    path: '/solutions',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_solution',
    name: 'Solution anlegen',
    description: 'Legt eine neue, leere Solution an (key, name, optional description).',
    category: 'solutions',
    path: '/solutions',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' } },
      required: ['key', 'name'],
    },
  });
  await register({
    key: 'add_solution_member',
    name: 'Solution-Mitglied hinzufügen',
    description: 'Fügt einer Solution eine App, einen Workflow, einen Agent, einen Wissensgraphen oder eine Entität hinzu (resourceType, resourceKey).',
    category: 'solutions',
    path: '/solutions/{key}/members',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key der Ziel-Solution.' },
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
    key: 'remove_solution_member',
    name: 'Solution-Mitglied entfernen',
    description: 'Entfernt ein Mitglied aus einer Solution.',
    category: 'solutions',
    path: '/solutions/{key}/members/{resourceType}/{resourceKey}',
    method: 'DELETE',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, resourceType: { type: 'string' }, resourceKey: { type: 'string' } },
      required: ['key', 'resourceType', 'resourceKey'],
    },
  });
}
bootstrap();
