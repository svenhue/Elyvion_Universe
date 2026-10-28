# integrations

A second category of actions sitting next to this platform's own internal ones ("wir haben die internen Aktionen, also Aktionen von der Plattform" — this module is the other category): actions that drive real third-party SaaS tools — Notion, Jira, Confluence, Slack, GitHub today.

## Architecture

- **`IntegrationProvider`** (`providers/provider.interface.ts`) — one third-party service: a key, a `connectionConfigSchema` (what credentials/settings it needs), and a list of `IntegrationActionDef`s. Each action's `call()` is a genuine HTTP implementation against that service's real REST API (correct endpoints, auth scheme, payload shapes, built from each provider's published API reference), not a stub — but **not live-tested**, since this environment has no Notion/Jira/Confluence/Slack/GitHub credentials to test against (the same situation `data-adapters`' SAP connector documents).
- **`Integration`** (Mongo) — one configured connection to a provider (`key`, `provider`, `name`, `connectionConfig`). A provider can have several Integrations — two different Jira sites, say — each reachable by its own `key`.
- **`ProviderRegistry`** — in-memory map of the five providers below. Adding a sixth means writing one `*.provider.ts` file and adding it to the registry array; nothing else changes.

## Providers and actions (50 today)

| Provider | Actions |
|---|---|
| Notion | search, get_page, create_page, update_page, archive_page, get_block_children, append_block_children, query_database, create_database, list_users |
| Jira | search_issues, get_issue, create_issue, update_issue, delete_issue, add_comment, transition_issue, list_projects, get_project, assign_issue |
| Confluence | search_content, get_page, create_page, update_page, delete_page, list_spaces, add_comment, get_page_children |
| Slack | send_message, update_message, delete_message, list_channels, create_channel, invite_to_channel, get_user_info, list_users, add_reaction, open_dm |
| GitHub | list_repos, get_repo, create_issue, list_issues, update_issue, create_pr, list_prs, merge_pr, create_comment, search_code |

Scaling toward "500+" from here is adding more providers and more of each one's endpoints — the architecture doesn't change, only the list of `*.provider.ts` files grows.

## Actions (via actions-engine)

Every provider action is registered as `<provider>_<action>` (e.g. `notion_create_page`, `jira_create_issue`), category `integrations`. Each one's input is `{ integrationKey, input: {...the action's own fields} }` — `integrationKey` picks which configured connection to run it against, since a provider can have more than one.

## Endpoints

`GET /providers` (catalog, for a UI to build a picker from), `POST /integrations`, `GET /integrations`, `GET /integrations/:key`, `DELETE /integrations/:key`, `POST /integrations/:key/actions/:actionKey/execute`.
