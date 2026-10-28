import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { IntegrationActionDef, IntegrationProvider } from './provider.interface';

const BASE_URL = 'https://slack.com/api';

function headers(config: Record<string, unknown>): HeadersInit {
  const botToken = config['botToken'];
  if (typeof botToken !== 'string' || !botToken) {
    throw new BadRequestException('Slack-Integration benötigt "connectionConfig.botToken".');
  }
  return { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json; charset=utf-8' };
}

/** Slack's Web API always answers 200 OK and signals failure via `{ok: false, error: "..."}` in the body — a plain HTTP-status check (what `requestJson` does) misses that, so every action here checks it explicitly. */
async function callSlack(url: string, init: RequestInit, errorContext: string): Promise<unknown> {
  const response = await fetch(url, init);
  const body = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !body.ok) {
    throw new BadGatewayException(`${errorContext} fehlgeschlagen: ${body.error ?? response.statusText}`);
  }
  return body;
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
    'send_message',
    'Nachricht senden',
    'Sendet eine Nachricht in einen Channel oder an einen Benutzer.',
    { type: 'object', properties: { channel: { type: 'string' }, text: { type: 'string' } }, required: ['channel', 'text'] },
    async (config, input) => callSlack(`${BASE_URL}/chat.postMessage`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack send_message'),
  ),
  action(
    'update_message',
    'Nachricht bearbeiten',
    'Bearbeitet eine bereits gesendete Nachricht.',
    { type: 'object', properties: { channel: { type: 'string' }, ts: { type: 'string' }, text: { type: 'string' } }, required: ['channel', 'ts', 'text'] },
    async (config, input) => callSlack(`${BASE_URL}/chat.update`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack update_message'),
  ),
  action(
    'delete_message',
    'Nachricht löschen',
    'Löscht eine Nachricht.',
    { type: 'object', properties: { channel: { type: 'string' }, ts: { type: 'string' } }, required: ['channel', 'ts'] },
    async (config, input) => callSlack(`${BASE_URL}/chat.delete`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack delete_message'),
  ),
  action(
    'list_channels',
    'Channels auflisten',
    'Listet alle Channels, die der Integration sichtbar sind.',
    { type: 'object', properties: {} },
    async (config) => callSlack(`${BASE_URL}/conversations.list`, { headers: headers(config) }, 'Slack list_channels'),
  ),
  action(
    'create_channel',
    'Channel anlegen',
    'Legt einen neuen Channel an.',
    { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    async (config, input) => callSlack(`${BASE_URL}/conversations.create`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack create_channel'),
  ),
  action(
    'invite_to_channel',
    'Zum Channel einladen',
    'Lädt Benutzer zu einem Channel ein.',
    { type: 'object', properties: { channel: { type: 'string' }, users: { type: 'string' } }, required: ['channel', 'users'] },
    async (config, input) => callSlack(`${BASE_URL}/conversations.invite`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack invite_to_channel'),
  ),
  action(
    'get_user_info',
    'Benutzer lesen',
    'Liest Profilinformationen eines Benutzers.',
    { type: 'object', properties: { user: { type: 'string' } }, required: ['user'] },
    async (config, input) => {
      const params = new URLSearchParams({ user: String(input['user']) });
      return callSlack(`${BASE_URL}/users.info?${params}`, { headers: headers(config) }, 'Slack get_user_info');
    },
  ),
  action(
    'list_users',
    'Benutzer auflisten',
    'Listet alle Mitglieder des Workspaces.',
    { type: 'object', properties: {} },
    async (config) => callSlack(`${BASE_URL}/users.list`, { headers: headers(config) }, 'Slack list_users'),
  ),
  action(
    'add_reaction',
    'Reaktion hinzufügen',
    'Fügt einer Nachricht eine Emoji-Reaktion hinzu.',
    { type: 'object', properties: { channel: { type: 'string' }, timestamp: { type: 'string' }, name: { type: 'string' } }, required: ['channel', 'timestamp', 'name'] },
    async (config, input) => callSlack(`${BASE_URL}/reactions.add`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack add_reaction'),
  ),
  action(
    'open_dm',
    'Direktnachricht-Kanal öffnen',
    'Öffnet (oder findet) den DM-Kanal mit einem oder mehreren Benutzern.',
    { type: 'object', properties: { users: { type: 'string' } }, required: ['users'] },
    async (config, input) => callSlack(`${BASE_URL}/conversations.open`, { method: 'POST', headers: headers(config), body: JSON.stringify(input) }, 'Slack open_dm'),
  ),
];

export const slackProvider: IntegrationProvider = {
  key: 'slack',
  name: 'Slack',
  connectionConfigSchema: { type: 'object', properties: { botToken: { type: 'string' } }, required: ['botToken'] },
  actions,
};
