import { BadRequestException } from '@nestjs/common';
import { IntegrationActionDef, IntegrationProvider, requestJson } from './provider.interface';

const BASE_URL = 'https://api.github.com';

function headers(config: Record<string, unknown>): HeadersInit {
  const token = config['token'];
  if (typeof token !== 'string' || !token) {
    throw new BadRequestException('GitHub-Integration benötigt "connectionConfig.token" (ein Personal Access Token).');
  }
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
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
    'list_repos',
    'Repositories auflisten',
    'Listet die Repositories des authentifizierten Benutzers.',
    { type: 'object', properties: {} },
    async (config) => requestJson(`${BASE_URL}/user/repos`, { headers: headers(config) }, 'GitHub list_repos'),
  ),
  action(
    'get_repo',
    'Repository lesen',
    'Liest ein Repository.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } }, required: ['owner', 'repo'] },
    async (config, input) => requestJson(`${BASE_URL}/repos/${input['owner']}/${input['repo']}`, { headers: headers(config) }, 'GitHub get_repo'),
  ),
  action(
    'create_issue',
    'Issue anlegen',
    'Legt ein neues Issue in einem Repository an.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['owner', 'repo', 'title'] },
    async (config, input) => {
      const { owner, repo, ...body } = input;
      return requestJson(`${BASE_URL}/repos/${owner}/${repo}/issues`, { method: 'POST', headers: headers(config), body: JSON.stringify(body) }, 'GitHub create_issue');
    },
  ),
  action(
    'list_issues',
    'Issues auflisten',
    'Listet die Issues eines Repositories.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } }, required: ['owner', 'repo'] },
    async (config, input) => {
      const params = new URLSearchParams({ state: String(input['state'] ?? 'open') });
      return requestJson(`${BASE_URL}/repos/${input['owner']}/${input['repo']}/issues?${params}`, { headers: headers(config) }, 'GitHub list_issues');
    },
  ),
  action(
    'update_issue',
    'Issue aktualisieren',
    'Aktualisiert Titel/Status/Body eines Issues.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, issue_number: { type: 'number' }, title: { type: 'string' }, body: { type: 'string' }, state: { type: 'string' } }, required: ['owner', 'repo', 'issue_number'] },
    async (config, input) => {
      const { owner, repo, issue_number, ...body } = input;
      return requestJson(`${BASE_URL}/repos/${owner}/${repo}/issues/${issue_number}`, { method: 'PATCH', headers: headers(config), body: JSON.stringify(body) }, 'GitHub update_issue');
    },
  ),
  action(
    'create_pr',
    'Pull Request anlegen',
    'Legt einen neuen Pull Request an.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, head: { type: 'string' }, base: { type: 'string' }, body: { type: 'string' } }, required: ['owner', 'repo', 'title', 'head', 'base'] },
    async (config, input) => {
      const { owner, repo, ...body } = input;
      return requestJson(`${BASE_URL}/repos/${owner}/${repo}/pulls`, { method: 'POST', headers: headers(config), body: JSON.stringify(body) }, 'GitHub create_pr');
    },
  ),
  action(
    'list_prs',
    'Pull Requests auflisten',
    'Listet die Pull Requests eines Repositories.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'] } }, required: ['owner', 'repo'] },
    async (config, input) => {
      const params = new URLSearchParams({ state: String(input['state'] ?? 'open') });
      return requestJson(`${BASE_URL}/repos/${input['owner']}/${input['repo']}/pulls?${params}`, { headers: headers(config) }, 'GitHub list_prs');
    },
  ),
  action(
    'merge_pr',
    'Pull Request mergen',
    'Merged einen Pull Request.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, pull_number: { type: 'number' } }, required: ['owner', 'repo', 'pull_number'] },
    async (config, input) =>
      requestJson(`${BASE_URL}/repos/${input['owner']}/${input['repo']}/pulls/${input['pull_number']}/merge`, { method: 'PUT', headers: headers(config) }, 'GitHub merge_pr'),
  ),
  action(
    'create_comment',
    'Kommentar hinzufügen',
    'Fügt einem Issue oder Pull Request einen Kommentar hinzu.',
    { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, issue_number: { type: 'number' }, body: { type: 'string' } }, required: ['owner', 'repo', 'issue_number', 'body'] },
    async (config, input) => {
      const { owner, repo, issue_number, ...body } = input;
      return requestJson(`${BASE_URL}/repos/${owner}/${repo}/issues/${issue_number}/comments`, { method: 'POST', headers: headers(config), body: JSON.stringify(body) }, 'GitHub create_comment');
    },
  ),
  action(
    'search_code',
    'Code durchsuchen',
    'Durchsucht Code über GitHub-weite (oder repo-eingeschränkte) Suche.',
    { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    async (config, input) => {
      const params = new URLSearchParams({ q: String(input['q']) });
      return requestJson(`${BASE_URL}/search/code?${params}`, { headers: headers(config) }, 'GitHub search_code');
    },
  ),
];

export const githubProvider: IntegrationProvider = {
  key: 'github',
  name: 'GitHub',
  connectionConfigSchema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] },
  actions,
};
