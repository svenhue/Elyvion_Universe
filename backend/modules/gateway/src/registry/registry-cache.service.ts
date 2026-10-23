import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';

export interface ModuleInfo {
  name: string;
  type: 'ts' | 'py';
  baseUrl: string;
  routePrefix: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

/**
 * Polls the Registry's module list and keeps an in-memory routing table so
 * every proxied request doesn't have to hit Registry over the network.
 */
@Injectable()
export class RegistryCacheService implements OnModuleInit {
  private readonly logger = new Logger(RegistryCacheService.name);
  private readonly cache = new Map<string, ModuleInfo>();
  private readonly registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  async onModuleInit() {
    await this.refresh();
  }

  @Cron('*/15 * * * * *')
  async refresh() {
    try {
      const response = await axios.get<{ data: ModuleInfo[] }>(`${this.registryUrl}/modules`, {
        timeout: 3000,
      });
      this.cache.clear();
      for (const module of response.data.data) {
        this.cache.set(module.name, module);
      }
    } catch {
      this.logger.warn('Could not refresh module list from Registry');
    }
  }

  get(name: string): ModuleInfo | undefined {
    return this.cache.get(name);
  }

  all(): ModuleInfo[] {
    return [...this.cache.values()];
  }
}
