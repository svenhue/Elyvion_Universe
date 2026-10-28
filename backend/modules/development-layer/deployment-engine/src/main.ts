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
  const port = Number(process.env.PORT ?? 3021);
  const moduleName = process.env.MODULE_NAME ?? 'deployment-engine';
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
  // actions' permissions under it — see data-adapters/src/main.ts for the
  // same pattern and security/README.md for the full design.
  await registerResource({ securityUrl, key: moduleName, name: 'Deployment-Engine' });
  await registerPermission({ securityUrl, resourceKey: moduleName, key: 'create_deployment_target', name: 'Deployment-Ziel anlegen' });
  await registerPermission({ securityUrl, resourceKey: moduleName, key: 'deploy_application', name: 'Anwendung deployen' });
  await registerPermission({ securityUrl, resourceKey: moduleName, key: 'stop_deployment', name: 'Deployment stoppen' });

  // Exposes "deploy the application" / "check its health" / "stop it" as
  // actions — Phase 1 of the CI/CD concept (see README.md): a configurable
  // target (today: local Docker; cloud providers are declared but not
  // implemented) that workflows/agents can drive the same way a person
  // would from the Deployments page.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName });

  await register({
    key: 'list_deployment_targets',
    name: 'Deployment-Ziele auflisten',
    description: 'Listet alle konfigurierten Deployment-Ziele (lokal oder Cloud).',
    category: 'deployment-engine',
    path: '/deployment-targets',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'create_deployment_target',
    name: 'Deployment-Ziel anlegen',
    description: 'Legt ein neues Deployment-Ziel an (type: local-docker | aws | gcp | azure, config je Typ).',
    category: 'deployment-engine',
    path: '/deployment-targets',
    method: 'POST',
    requiredPermission: `${moduleName}:create_deployment_target`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['local-docker', 'aws', 'gcp', 'azure'] },
        config: { type: 'object' },
      },
      required: ['name', 'type'],
    },
  });
  await register({
    key: 'deploy_application',
    name: 'Anwendung deployen',
    description: 'Baut und startet die Anwendung auf dem angegebenen Deployment-Ziel.',
    category: 'deployment-engine',
    path: '/deployments',
    method: 'POST',
    requiredPermission: `${moduleName}:deploy_application`,
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, targetId: { type: 'string' } },
      required: ['name', 'targetId'],
    },
  });
  await register({
    key: 'list_deployments',
    name: 'Deployments auflisten',
    description: 'Listet alle Deployments mit ihrem letzten bekannten Status.',
    category: 'deployment-engine',
    path: '/deployments',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'get_deployment_status',
    name: 'Deployment-Status abrufen',
    description: 'Fragt den Live-Status eines Deployments ab (z. B. per docker inspect) — unabhängig davon, was die Anwendung selbst meldet.',
    category: 'deployment-engine',
    path: '/deployments/{id}/status',
    method: 'GET',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
  await register({
    key: 'stop_deployment',
    name: 'Deployment stoppen',
    description: 'Stoppt ein laufendes Deployment.',
    category: 'deployment-engine',
    path: '/deployments/{id}/stop',
    method: 'POST',
    requiredPermission: `${moduleName}:stop_deployment`,
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  });
}
bootstrap();
