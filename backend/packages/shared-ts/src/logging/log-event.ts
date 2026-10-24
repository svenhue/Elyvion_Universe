import axios from 'axios';

export interface LogEventOptions {
  loggingUrl: string;
  source: string;
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  actionKey?: string;
  context?: Record<string, unknown>;
}

/**
 * Fire-and-forget — a logging call failing must never break whatever it's
 * logging, so this neither retries nor throws, just swallows the error
 * (unlike `registerModule`/`registerRemoteAction`, which retry because a
 * missed *registration* really does need to succeed eventually).
 */
export async function logEvent(options: LogEventOptions): Promise<void> {
  const { loggingUrl, ...payload } = options;
  try {
    await axios.post(`${loggingUrl}/logs`, payload, { timeout: 2000 });
  } catch {
    // Intentionally silent — see doc comment above.
  }
}
