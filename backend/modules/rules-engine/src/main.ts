import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3024);
  const moduleName = process.env.MODULE_NAME ?? 'rules-engine';
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

  // Exposes "run this business rule" as an action, so a Workflow step
  // (type: 'rule') or an agent can execute a rule the same way a person
  // would from the Logik page — see README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_rules',
    name: 'Regeln auflisten',
    description: 'Listet alle Geschäftsregeln.',
    category: 'rules-engine',
    path: '/rules',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_rule',
    name: 'Regel anlegen',
    description: 'Legt eine neue Geschäftsregel an (key, name, blocks: eine Pipeline aus filter/aggregate/decision/classify-Blöcken).',
    category: 'rules-engine',
    path: '/rules',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        inputSchema: { type: 'object' },
        blocks: { type: 'array' },
        outputFormat: { type: 'object' },
      },
      required: ['key', 'name'],
    },
  });
  await register({
    key: 'execute_rule',
    name: 'Regel ausführen',
    description: 'Führt eine Geschäftsregel mit dem gegebenen Input aus und liefert das Ergebnis der letzten Pipeline-Stufe zurück.',
    category: 'rules-engine',
    path: '/rules/{key}/execute',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, input: {} },
      required: ['key', 'input'],
    },
  });
}
bootstrap();
