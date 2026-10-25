import { BadGatewayException } from '@nestjs/common';

/**
 * One callable operation against a third-party service. `call()` makes
 * the real HTTP request against that service's real REST API — these
 * are genuine implementations, not stubs, but they're built from each
 * service's published API reference rather than live-tested, since this
 * environment has no Notion/Jira/Confluence/Slack/GitHub credentials to
 * test against (same situation as `data-adapters`' SAP connector).
 */
export interface IntegrationActionDef {
  /** Unique within its provider (e.g. "create_page") — the full action key registered with actions-engine is `${provider}_${key}`. */
  key: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  call(connectionConfig: Record<string, unknown>, input: Record<string, unknown>): Promise<unknown>;
}

/** One third-party service, and every action this module knows how to perform against it. */
export interface IntegrationProvider {
  key: string;
  name: string;
  /** What `connectionConfig` needs to hold for any of this provider's actions to run — descriptive only, shown in the UI. */
  connectionConfigSchema: Record<string, unknown>;
  actions: IntegrationActionDef[];
}

/**
 * Thin fetch wrapper every provider's actions share: JSON in, JSON out.
 * Throws a `BadGatewayException` (not a plain `Error`) on a non-2xx
 * status specifically so Nest's default exception filter forwards the
 * real provider error to the caller as a 502 with that detail in the
 * body — a plain `Error` here would otherwise flatten into an opaque
 * 500, hiding exactly the information ("API token is invalid", say)
 * the caller needs to fix their connectionConfig.
 */
export async function requestJson(
  url: string,
  init: RequestInit,
  errorContext: string,
): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : null;
  if (!response.ok) {
    throw new BadGatewayException(`${errorContext} fehlgeschlagen (${response.status}): ${JSON.stringify(parsed ?? text)}`);
  }
  return parsed;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
