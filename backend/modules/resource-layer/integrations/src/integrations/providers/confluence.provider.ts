import { BadRequestException } from '@nestjs/common';
import { IntegrationActionDef, IntegrationProvider, requestJson } from './provider.interface';

function baseUrl(config: Record<string, unknown>): string {
  const domain = config['domain'];
  if (typeof domain !== 'string' || !domain) {
    throw new BadRequestException('Confluence-Integration benötigt "connectionConfig.domain" (z. B. "meinefirma", für meinefirma.atlassian.net).');
  }
  return `https://${domain}.atlassian.net/wiki/rest/api`;
}

function headers(config: Record<string, unknown>): HeadersInit {
  const email = config['email'];
  const apiToken = config['apiToken'];
  if (typeof email !== 'string' || !email || typeof apiToken !== 'string' || !apiToken) {
    throw new BadRequestException('Confluence-Integration benötigt "connectionConfig.email" und "connectionConfig.apiToken".');
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
    'search_content',
    'Inhalte suchen',
    'Sucht Pages/Blog-Posts per CQL (Confluence Query Language).',
    { type: 'object', properties: { cql: { type: 'string' } }, required: ['cql'] },
    async (config, input) => {
      const params = new URLSearchParams({ cql: String(input['cql']) });
      return requestJson(`${baseUrl(config)}/content/search?${params}`, { headers: headers(config) }, 'Confluence search_content');
    },
  ),
  action(
    'get_page',
    'Page lesen',
    'Liest eine Page inkl. ihres Inhalts (storage-Format).',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    async (config, input) => requestJson(`${baseUrl(config)}/content/${input['id']}?expand=body.storage,version`, { headers: headers(config) }, 'Confluence get_page'),
  ),
  action(
    'create_page',
    'Page anlegen',
    'Legt eine neue Page in einem Space an.',
    {
      type: 'object',
      properties: { spaceKey: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, ancestorId: { type: 'string' } },
      required: ['spaceKey', 'title', 'body'],
    },
    async (config, input) => {
      const payload = {
        type: 'page',
        title: input['title'],
        space: { key: input['spaceKey'] },
        body: { storage: { value: input['body'], representation: 'storage' } },
        ...(input['ancestorId'] ? { ancestors: [{ id: input['ancestorId'] }] } : {}),
      };
      return requestJson(`${baseUrl(config)}/content`, { method: 'POST', headers: headers(config), body: JSON.stringify(payload) }, 'Confluence create_page');
    },
  ),
  action(
    'update_page',
    'Page aktualisieren',
    'Aktualisiert eine Page (benötigt die aktuelle Versionsnummer + 1).',
    { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, version: { type: 'number' } }, required: ['id', 'title', 'body', 'version'] },
    async (config, input) => {
      const payload = {
        type: 'page',
        title: input['title'],
        body: { storage: { value: input['body'], representation: 'storage' } },
        version: { number: input['version'] },
      };
      return requestJson(`${baseUrl(config)}/content/${input['id']}`, { method: 'PUT', headers: headers(config), body: JSON.stringify(payload) }, 'Confluence update_page');
    },
  ),
  action(
    'delete_page',
    'Page löschen',
    'Verschiebt eine Page in den Papierkorb.',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    async (config, input) => requestJson(`${baseUrl(config)}/content/${input['id']}`, { method: 'DELETE', headers: headers(config) }, 'Confluence delete_page'),
  ),
  action(
    'list_spaces',
    'Spaces auflisten',
    'Listet alle für die Integration sichtbaren Spaces.',
    { type: 'object', properties: {} },
    async (config) => requestJson(`${baseUrl(config)}/space`, { headers: headers(config) }, 'Confluence list_spaces'),
  ),
  action(
    'add_comment',
    'Kommentar hinzufügen',
    'Fügt einer Page einen Kommentar hinzu.',
    { type: 'object', properties: { pageId: { type: 'string' }, body: { type: 'string' } }, required: ['pageId', 'body'] },
    async (config, input) => {
      const payload = {
        type: 'comment',
        container: { id: input['pageId'], type: 'page' },
        body: { storage: { value: input['body'], representation: 'storage' } },
      };
      return requestJson(`${baseUrl(config)}/content`, { method: 'POST', headers: headers(config), body: JSON.stringify(payload) }, 'Confluence add_comment');
    },
  ),
  action(
    'get_page_children',
    'Unterseiten lesen',
    'Listet die direkten Unterseiten einer Page.',
    { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    async (config, input) => requestJson(`${baseUrl(config)}/content/${input['id']}/child/page`, { headers: headers(config) }, 'Confluence get_page_children'),
  ),
];

export const confluenceProvider: IntegrationProvider = {
  key: 'confluence',
  name: 'Confluence',
  connectionConfigSchema: {
    type: 'object',
    properties: { domain: { type: 'string' }, email: { type: 'string' }, apiToken: { type: 'string' } },
    required: ['domain', 'email', 'apiToken'],
  },
  actions,
};
