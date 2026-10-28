import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { ACTION_METADATA_KEY, ActionHandler, ActionMetadata } from './action.types';

export interface RegisteredAction {
  metadata: ActionMetadata;
  handler: ActionHandler;
}

/**
 * Builds the in-memory map of backend actions once, on boot, by scanning
 * every provider in the module tree for `@RegisterAction(...)` metadata —
 * see that decorator's doc comment for why this beats a manually
 * maintained list.
 */
@Injectable()
export class ActionsRegistry implements OnModuleInit {
  private readonly actions = new Map<string, RegisteredAction>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as ActionHandler | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const metadata = this.reflector.get<ActionMetadata | undefined>(
        ACTION_METADATA_KEY,
        instance.constructor,
      );
      if (!metadata) continue;
      this.actions.set(metadata.key, { metadata, handler: instance });
    }
  }

  list(): ActionMetadata[] {
    return [...this.actions.values()].map((entry) => entry.metadata);
  }

  get(key: string): RegisteredAction | undefined {
    return this.actions.get(key);
  }
}
