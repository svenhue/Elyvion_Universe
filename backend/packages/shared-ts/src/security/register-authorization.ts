import axios from 'axios';

export interface RegisterResourceOptions {
  securityUrl: string;
  key: string;
  name: string;
  description?: string;
}

export interface RegisterPermissionOptions {
  securityUrl: string;
  resourceKey: string;
  key: string;
  name: string;
  description?: string;
}

/**
 * Self-registration a module calls once from its own `main.ts` on boot —
 * "jedes Modul muss exposen, welche Berechtigung es hat, unter seiner
 * Ressourcengruppe" — mirroring `registerModule`'s and
 * `registerRemoteAction`'s own self-registration pattern, including the
 * retry loop (a missed registration here really does need to eventually
 * succeed, unlike a log line).
 */
export async function registerResource(options: RegisterResourceOptions, retries = 5, delayMs = 2000): Promise<void> {
  const { securityUrl, ...payload } = options;
  await postWithRetry(`${securityUrl}/resources`, payload, retries, delayMs, options.key);
}

export async function registerPermission(options: RegisterPermissionOptions, retries = 5, delayMs = 2000): Promise<void> {
  const { securityUrl, ...payload } = options;
  await postWithRetry(`${securityUrl}/permissions`, payload, retries, delayMs, `${options.resourceKey}:${options.key}`);
}

async function postWithRetry(url: string, payload: unknown, retries: number, delayMs: number, label: string): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(url, payload, { timeout: 3000 });
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error(`[registerAuthorization] Failed to register "${label}" at ${url} after ${retries} attempts:`, err instanceof Error ? err.message : err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
