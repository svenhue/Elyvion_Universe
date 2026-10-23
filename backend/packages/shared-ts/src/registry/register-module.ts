import axios from 'axios';

export interface RegisterModuleOptions {
  registryUrl: string;
  name: string;
  type: 'ts' | 'py';
  baseUrl: string;
  routePrefix: string;
  healthCheckUrl: string;
  version: string;
}

/**
 * Self-registration called once from main.ts on bootstrap. The Registry
 * keeps modules alive via periodic health checks, so this only needs to
 * run once per process start (with a few retries in case Registry boots
 * slightly after this module does).
 */
export async function registerModule(
  options: RegisterModuleOptions,
  retries = 5,
  delayMs = 2000,
): Promise<void> {
  const { registryUrl, ...payload } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.post(`${registryUrl}/modules/register`, payload, { timeout: 3000 });
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error(
          `[registerModule] Failed to register "${options.name}" with Registry after ${retries} attempts:`,
          err instanceof Error ? err.message : err,
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
