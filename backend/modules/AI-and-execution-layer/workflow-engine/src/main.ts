import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3014);
  const baseUrl = process.env.MODULE_BASE_URL ?? `http://localhost:${port}`;
  const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';
  const actionsEngineUrl = process.env.ACTIONS_ENGINE_URL ?? 'http://localhost:3015';

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ElyvionExceptionFilter());
  app.enableCors();

  await app.listen(port);
  console.log(`[workflow-engine] listening on :${port}`);

  await registerModule({
    registryUrl,
    name: 'workflow-engine',
    type: 'ts',
    baseUrl,
    routePrefix: '/',
    healthCheckUrl: `http://localhost:${port}/health`,
    version: '0.1.0',
  });

  // Exposes this module's own capabilities as actions — so an agent whose
  // job is building workflows can see what exists, create/version new
  // definitions, and trigger a backend-target run. See
  // workflow-engine/README.md.
  const register = (options: Omit<Parameters<typeof registerRemoteAction>[0], 'actionsEngineUrl' | 'moduleName'>) =>
    registerRemoteAction({ ...options, actionsEngineUrl, moduleName: 'workflow-engine' });

  await register({
    key: 'list_workflows',
    name: 'Workflows auflisten',
    description: 'Listet alle gespeicherten Workflow-Definitionen (neueste Version je Key).',
    category: 'workflow-engine',
    path: '/definitions',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await register({
    key: 'get_workflow',
    name: 'Workflow lesen',
    description: 'Liest die neueste Version einer Workflow-Definition anhand ihres Keys.',
    category: 'workflow-engine',
    path: '/definitions/{key}',
    method: 'GET',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
  });
  await register({
    key: 'create_workflow',
    name: 'Workflow anlegen',
    description: 'Speichert eine neue Workflow-Definition (key, name, target "frontend"|"backend", startStepId, steps). Ein bereits existierender Key bekommt eine neue Version statt überschrieben zu werden.',
    category: 'workflow-engine',
    path: '/definitions',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        name: { type: 'string' },
        target: { type: 'string', enum: ['frontend', 'backend'] },
        startStepId: { type: 'string' },
        steps: { type: 'array', description: 'WorkflowStep[] — siehe workflow-engine/src/workflow/workflow-schema.ts.' },
      },
      required: ['key', 'name', 'target', 'startStepId', 'steps'],
    },
  });
  await register({
    key: 'run_workflow',
    name: 'Workflow ausführen',
    description: 'Startet einen Lauf eines backend-target Workflows.',
    category: 'workflow-engine',
    path: '/definitions/{key}/run',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, context: { type: 'object' } },
      required: ['key'],
    },
  });
}
bootstrap();
