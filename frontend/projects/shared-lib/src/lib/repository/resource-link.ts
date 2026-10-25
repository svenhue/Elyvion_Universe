import { ResourceType } from './resource-type';

export interface ResourceLink {
  commands: unknown[];
  queryParams?: Record<string, string>;
}

/**
 * Where a Solution/Repository member's own editor lives — "wenn ich auf
 * so einen Workflow mit einem Doppelklick gehe, möchte ich das auch
 * direkt öffnen können." Pages that can select a specific item from a
 * route read `open` as a query param (`workflow-builder`, `rules-engine`,
 * `data-engine` — see each component's `ngOnInit`); `application` gets a
 * real path segment since `/pro-code/:applicationId` already is one.
 * `agent` lands on the page with no further selection (prompts aren't a
 * list you pick one of the same way); `data-adapter`/`action`/
 * `knowledge_graph` have no page to open at all.
 */
export function linkFor(resourceType: ResourceType, resourceKey: string): ResourceLink | null {
  switch (resourceType) {
    case 'workflow':
      return { commands: ['/workflows/builder', resourceKey] };
    case 'rule':
      return { commands: ['/rules'], queryParams: { open: resourceKey } };
    case 'entity':
      return { commands: ['/data'], queryParams: { open: resourceKey } };
    case 'application':
      return { commands: ['/pro-code', resourceKey] };
    case 'agent':
      return { commands: ['/agents'] };
    case 'repository':
      return { commands: ['/repository'], queryParams: { open: resourceKey } };
    case 'solution':
      return { commands: ['/solutions'], queryParams: { open: resourceKey } };
    default:
      return null;
  }
}
