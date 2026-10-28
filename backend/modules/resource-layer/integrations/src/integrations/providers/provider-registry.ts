import { Injectable, NotFoundException } from '@nestjs/common';
import { confluenceProvider } from './confluence.provider';
import { githubProvider } from './github.provider';
import { jiraProvider } from './jira.provider';
import { notionProvider } from './notion.provider';
import { IntegrationProvider } from './provider.interface';
import { slackProvider } from './slack.provider';

/**
 * Every third-party service this module knows how to talk to. Adding a
 * provider means writing one `*.provider.ts` file (see `notion.provider.ts`
 * for the shape) and adding it here — nothing else in the module changes,
 * same extensibility pattern as `data-adapters`' connector registry.
 * Five real providers today (Notion, Jira, Confluence, Slack, GitHub),
 * ~10 genuine actions each — scaling toward "500+" from here is adding
 * more providers and more of each one's endpoints, not new architecture.
 */
const PROVIDERS: IntegrationProvider[] = [notionProvider, jiraProvider, confluenceProvider, slackProvider, githubProvider];

@Injectable()
export class ProviderRegistry {
  private readonly byKey = new Map(PROVIDERS.map((provider) => [provider.key, provider]));

  list(): IntegrationProvider[] {
    return [...this.byKey.values()];
  }

  get(key: string): IntegrationProvider {
    const provider = this.byKey.get(key);
    if (!provider) throw new NotFoundException(`Provider "${key}" ist nicht bekannt.`);
    return provider;
  }
}
