import { NestFactory } from '@nestjs/core';
import { ElyvionExceptionFilter, registerModule, registerRemoteAction } from '@elyvion/shared';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { confluenceProvider } from './integrations/providers/confluence.provider';
import { githubProvider } from './integrations/providers/github.provider';
import { jiraProvider } from './integrations/providers/jira.provider';
import { notionProvider } from './integrations/providers/notion.provider';
import { IntegrationProvider } from './integrations/providers/provider.interface';
import { slackProvider } from './integrations/providers/slack.provider';

const PROVIDERS: IntegrationProvider[] = [notionProvider, jiraProvider, confluenceProvider, slackProvider, githubProvider];

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3025);
  const moduleName = process.env.MODULE_NAME ?? 'integrations';
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

  // Integration-connection management, exposed as actions too — so a
  // connection can be created/listed/removed from the existing Actions
  // page's generic form, without needing a dedicated management UI.
  await registerRemoteAction({
    actionsEngineUrl,
    moduleName,
    key: 'list_integrations',
    name: 'Integrationen auflisten',
    description: 'Listet alle konfigurierten Integrationen (Notion/Jira/Confluence/Slack/GitHub-Verbindungen).',
    category: 'integrations',
    path: '/integrations',
    method: 'GET',
    inputSchema: { type: 'object', properties: {} },
  });
  await registerRemoteAction({
    actionsEngineUrl,
    moduleName,
    key: 'create_integration',
    name: 'Integration anlegen',
    description: 'Legt eine neue Integration an (key, provider: notion|jira|confluence|slack|github, name, connectionConfig).',
    category: 'integrations',
    path: '/integrations',
    method: 'POST',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        provider: { type: 'string', enum: PROVIDERS.map((p) => p.key) },
        name: { type: 'string' },
        connectionConfig: { type: 'object', description: 'Siehe GET /providers für das jeweils benötigte Schema.' },
      },
      required: ['key', 'provider', 'name', 'connectionConfig'],
    },
  });
  await registerRemoteAction({
    actionsEngineUrl,
    moduleName,
    key: 'remove_integration',
    name: 'Integration löschen',
    description: 'Löscht eine konfigurierte Integration.',
    category: 'integrations',
    path: '/integrations/{key}',
    method: 'DELETE',
    inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
  });

  // Every provider action becomes its own actions-engine action, named
  // "<provider>_<action>" (e.g. "notion_create_page") — a second,
  // external-integrations category sitting next to this platform's own
  // internal actions. `integrationKey` picks which configured connection
  // (which Notion workspace, which Jira site, ...) to run it against,
  // since a provider can have more than one.
  let registeredCount = 0;
  for (const provider of PROVIDERS) {
    for (const action of provider.actions) {
      await registerRemoteAction({
        actionsEngineUrl,
        moduleName,
        key: `${provider.key}_${action.key}`,
        name: `${provider.name}: ${action.name}`,
        description: `[${provider.name}] ${action.description}`,
        category: 'integrations',
        path: `/integrations/{integrationKey}/actions/${action.key}/execute`,
        method: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            integrationKey: { type: 'string', description: `Key der konfigurierten ${provider.name}-Integration.` },
            input: action.inputSchema,
          },
          required: ['integrationKey'],
        },
      });
      registeredCount++;
    }
  }
  console.log(`[${moduleName}] registered ${registeredCount} integration actions across ${PROVIDERS.length} providers`);
}
bootstrap();
