import { BadRequestException } from '@nestjs/common';
import { IntegrationActionDef, IntegrationProvider, requestJson } from './provider.interface';

const BASE_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function headers(config: Record<string, unknown>): HeadersInit {
  const apiKey = config['apiKey'];
  if (typeof apiKey !== 'string' || !apiKey) {
    throw new BadRequestException('Notion-Integration benötigt "connectionConfig.apiKey".');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
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
    'search',
    'Suchen',
    'Durchsucht alle für die Integration freigegebenen Pages und Datenbanken.',
    { type: 'object', properties: { query: { type: 'string' } } },
    async (config, input) => requestJson(`${BASE_URL}/search`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Notion-Suche'),
  ),
  action(
    'get_page',
    'Page lesen',
    'Liest eine Page anhand ihrer Id.',
    { type: 'object', properties: { page_id: { type: 'string' } }, required: ['page_id'] },
    async (config, input) => requestJson(`${BASE_URL}/pages/${input['page_id']}`, { headers: headers(config) }, 'Notion get_page'),
  ),
  action(
    'create_page',
    'Page anlegen',
    'Legt eine neue Page unter einem Parent (Page oder Datenbank) an.',
    {
      type: 'object',
      properties: { parent: { type: 'object' }, properties: { type: 'object' }, children: { type: 'array' } },
      required: ['parent', 'properties'],
    },
    async (config, input) => requestJson(`${BASE_URL}/pages`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Notion create_page'),
  ),
  action(
    'update_page',
    'Page aktualisieren',
    'Aktualisiert die Properties einer bestehenden Page.',
    { type: 'object', properties: { page_id: { type: 'string' }, properties: { type: 'object' } }, required: ['page_id', 'properties'] },
    async (config, input) => {
      const { page_id, ...body } = input;
      return requestJson(`${BASE_URL}/pages/${page_id}`, { method: 'PATCH', headers: headers(config), body: JSON.stringify(body) }, 'Notion update_page');
    },
  ),
  action(
    'archive_page',
    'Page archivieren',
    'Verschiebt eine Page in den Papierkorb.',
    { type: 'object', properties: { page_id: { type: 'string' } }, required: ['page_id'] },
    async (config, input) =>
      requestJson(`${BASE_URL}/pages/${input['page_id']}`, { method: 'PATCH', headers: headers(config), body: JSON.stringify({ archived: true }) }, 'Notion archive_page'),
  ),
  action(
    'get_block_children',
    'Block-Children lesen',
    'Liest die Kind-Blöcke einer Page oder eines Blocks.',
    { type: 'object', properties: { block_id: { type: 'string' } }, required: ['block_id'] },
    async (config, input) => requestJson(`${BASE_URL}/blocks/${input['block_id']}/children`, { headers: headers(config) }, 'Notion get_block_children'),
  ),
  action(
    'append_block_children',
    'Blöcke anhängen',
    'Hängt neue Blöcke an eine Page oder einen Block an.',
    { type: 'object', properties: { block_id: { type: 'string' }, children: { type: 'array' } }, required: ['block_id', 'children'] },
    async (config, input) => {
      const { block_id, ...body } = input;
      return requestJson(`${BASE_URL}/blocks/${block_id}/children`, { method: 'PATCH', headers: headers(config), body: JSON.stringify(body) }, 'Notion append_block_children');
    },
  ),
  action(
    'query_database',
    'Datenbank abfragen',
    'Fragt die Einträge einer Datenbank ab, optional gefiltert/sortiert.',
    { type: 'object', properties: { database_id: { type: 'string' }, filter: { type: 'object' }, sorts: { type: 'array' } }, required: ['database_id'] },
    async (config, input) => {
      const { database_id, ...body } = input;
      return requestJson(`${BASE_URL}/databases/${database_id}/query`, { method: 'POST', headers: headers(config), body: JSON.stringify(body) }, 'Notion query_database');
    },
  ),
  action(
    'create_database',
    'Datenbank anlegen',
    'Legt eine neue Datenbank unter einer Parent-Page an.',
    { type: 'object', properties: { parent: { type: 'object' }, title: { type: 'array' }, properties: { type: 'object' } }, required: ['parent', 'properties'] },
    async (config, input) => requestJson(`${BASE_URL}/databases`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Notion create_database'),
  ),
  action(
    'list_users',
    'Benutzer auflisten',
    'Listet alle Benutzer des Workspaces.',
    { type: 'object', properties: {} },
    async (config) => requestJson(`${BASE_URL}/users`, { headers: headers(config) }, 'Notion list_users'),
  ),
];

export const notionProvider: IntegrationProvider = {
  key: 'notion',
  name: 'Notion',
  connectionConfigSchema: { type: 'object', properties: { apiKey: { type: 'string' } }, required: ['apiKey'] },
  actions,
};
