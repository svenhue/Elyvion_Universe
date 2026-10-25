import { BadRequestException } from '@nestjs/common';
import { IntegrationActionDef, IntegrationProvider, requestJson } from './provider.interface';

function baseUrl(config: Record<string, unknown>): string {
  const domain = config['domain'];
  if (typeof domain !== 'string' || !domain) {
    throw new BadRequestException('Jira-Integration benötigt "connectionConfig.domain" (z. B. "meinefirma", für meinefirma.atlassian.net).');
  }
  return `https://${domain}.atlassian.net/rest/api/3`;
}

function headers(config: Record<string, unknown>): HeadersInit {
  const email = config['email'];
  const apiToken = config['apiToken'];
  if (typeof email !== 'string' || !email || typeof apiToken !== 'string' || !apiToken) {
    throw new BadRequestException('Jira-Integration benötigt "connectionConfig.email" und "connectionConfig.apiToken".');
  }
  const basic = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

function action(
  key: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  call: IntegrationActionDef['call'],
): IntegrationActionDef {
  return { key, name, description, inputSchema, call };
}

const actions: IntegrationActionDef[] = [
  action(
    'search_issues',
    'Issues suchen',
    'Sucht Issues per JQL (Jira Query Language).',
    { type: 'object', properties: { jql: { type: 'string' }, maxResults: { type: 'number' } }, required: ['jql'] },
    async (config, input) => {
      const params = new URLSearchParams({ jql: String(input['jql']), maxResults: String(input['maxResults'] ?? 50) });
      return requestJson(`${baseUrl(config)}/search?${params}`, { headers: headers(config) }, 'Jira search_issues');
    },
  ),
  action(
    'get_issue',
    'Issue lesen',
    'Liest ein Issue anhand seines Keys (z. B. "PROJ-123").',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' } }, required: ['issueIdOrKey'] },
    async (config, input) => requestJson(`${baseUrl(config)}/issue/${input['issueIdOrKey']}`, { headers: headers(config) }, 'Jira get_issue'),
  ),
  action(
    'create_issue',
    'Issue anlegen',
    'Legt ein neues Issue an (fields: project, summary, issuetype, …).',
    { type: 'object', properties: { fields: { type: 'object' } }, required: ['fields'] },
    async (config, input) => requestJson(`${baseUrl(config)}/issue`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Jira create_issue'),
  ),
  action(
    'update_issue',
    'Issue aktualisieren',
    'Aktualisiert die Felder eines bestehenden Issues.',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' }, fields: { type: 'object' } }, required: ['issueIdOrKey', 'fields'] },
    async (config, input) => {
      const { issueIdOrKey, ...body } = input;
      return requestJson(`${baseUrl(config)}/issue/${issueIdOrKey}`, { method: 'PUT', headers: headers(config), body: JSON.stringify(body) }, 'Jira update_issue');
    },
  ),
  action(
    'delete_issue',
    'Issue löschen',
    'Löscht ein Issue unwiderruflich.',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' } }, required: ['issueIdOrKey'] },
    async (config, input) => requestJson(`${baseUrl(config)}/issue/${input['issueIdOrKey']}`, { method: 'DELETE', headers: headers(config) }, 'Jira delete_issue'),
  ),
  action(
    'add_comment',
    'Kommentar hinzufügen',
    'Fügt einem Issue einen Kommentar hinzu.',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' }, body: { type: 'string' } }, required: ['issueIdOrKey', 'body'] },
    async (config, input) =>
      requestJson(
        `${baseUrl(config)}/issue/${input['issueIdOrKey']}/comment`,
        { method: 'POST', headers: headers(config), body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: input['body'] }] }] } }) },
        'Jira add_comment',
      ),
  ),
  action(
    'transition_issue',
    'Issue-Status ändern',
    'Führt einen Status-Übergang (Transition) auf einem Issue aus.',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' }, transitionId: { type: 'string' } }, required: ['issueIdOrKey', 'transitionId'] },
    async (config, input) =>
      requestJson(
        `${baseUrl(config)}/issue/${input['issueIdOrKey']}/transitions`,
        { method: 'POST', headers: headers(config), body: JSON.stringify({ transition: { id: input['transitionId'] } }) },
        'Jira transition_issue',
      ),
  ),
  action(
    'list_projects',
    'Projekte auflisten',
    'Listet alle für die Integration sichtbaren Projekte.',
    { type: 'object', properties: {} },
    async (config) => requestJson(`${baseUrl(config)}/project/search`, { headers: headers(config) }, 'Jira list_projects'),
  ),
  action(
    'get_project',
    'Projekt lesen',
    'Liest ein Projekt anhand seines Keys oder seiner Id.',
    { type: 'object', properties: { projectIdOrKey: { type: 'string' } }, required: ['projectIdOrKey'] },
    async (config, input) => requestJson(`${baseUrl(config)}/project/${input['projectIdOrKey']}`, { headers: headers(config) }, 'Jira get_project'),
  ),
  action(
    'assign_issue',
    'Issue zuweisen',
    'Weist ein Issue einem Benutzer zu (accountId).',
    { type: 'object', properties: { issueIdOrKey: { type: 'string' }, accountId: { type: 'string' } }, required: ['issueIdOrKey', 'accountId'] },
    async (config, input) =>
      requestJson(
        `${baseUrl(config)}/issue/${input['issueIdOrKey']}/assignee`,
        { method: 'PUT', headers: headers(config), body: JSON.stringify({ accountId: input['accountId'] }) },
        'Jira assign_issue',
      ),
  ),
];

export const jiraProvider: IntegrationProvider = {
  key: 'jira',
  name: 'Jira',
  connectionConfigSchema: {
    type: 'object',
    properties: { domain: { type: 'string' }, email: { type: 'string' }, apiToken: { type: 'string' } },
    required: ['domain', 'email', 'apiToken'],
  },
  actions,
};
