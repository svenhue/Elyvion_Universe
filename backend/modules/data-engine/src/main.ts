import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3017);
  const moduleName = process.env.MODULE_NAME ?? 'data-engine';
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

  // Exposes this module's own capabilities as actions, so an agent "whose
  // job is editing a whole data model" can see what entities exist,
  // define new ones, and manage their records — see data-engine/README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_entities',
    name: 'Entitäten auflisten',
    description: 'Listet alle definierten Entitäten mit ihren Feldern.',
    category: 'data-engine',
    path: '/entities',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_entity',
    name: 'Entität anlegen',
    description: 'Definiert eine neue Entität (Name + Felder: name, type [string|number|boolean|date], required) und provisioniert sofort eine passende Datensammlung samt REST-API.',
    category: 'data-engine',
    path: '/entities',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string', enum: ['string', 'number', 'boolean', 'date'] },
              required: { type: 'boolean' },
            },
          },
        },
      },
      required: ['name', 'fields'],
    },
  });
  await register({
    key: 'delete_entity',
    name: 'Entität löschen',
    description: 'Löscht eine Entitätsdefinition und ihre gesamte Datensammlung.',
    category: 'data-engine',
    path: '/entities/{name}',
    method: 'DELETE',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  });
  await register({
    key: 'list_records',
    name: 'Datensätze auflisten',
    description: 'Listet alle Datensätze einer Entität.',
    category: 'data-engine',
    path: '/data/{entity}',
    method: 'GET',
    inputSchema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] },
  });
  await register({
    key: 'create_record',
    name: 'Datensatz anlegen',
    description: 'Legt einen neuen Datensatz einer Entität an. Weitere Felder werden gegen die Felddefinition der Entität validiert.',
    category: 'data-engine',
    path: '/data/{entity}',
    method: 'POST',
    inputSchema: { type: 'object', properties: { entity: { type: 'string' } }, required: ['entity'] },
  });
  await register({
    key: 'update_record',
    name: 'Datensatz bearbeiten',
    description: 'Ändert Felder eines bestehenden Datensatzes.',
    category: 'data-engine',
    path: '/data/{entity}/{id}',
    method: 'PATCH',
    inputSchema: { type: 'object', properties: { entity: { type: 'string' }, id: { type: 'string' } }, required: ['entity', 'id'] },
  });
  await register({
    key: 'delete_record',
    name: 'Datensatz löschen',
    description: 'Löscht einen Datensatz einer Entität.',
    category: 'data-engine',
    path: '/data/{entity}/{id}',
    method: 'DELETE',
    inputSchema: { type: 'object', properties: { entity: { type: 'string' }, id: { type: 'string' } }, required: ['entity', 'id'] },
  });
}
bootstrap();
