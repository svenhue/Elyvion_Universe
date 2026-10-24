import { AnyZodObject, ZodTypeAny } from 'zod';

export const ACTION_METADATA_KEY = Symbol('ELYVION_ACTION');

/**
 * Declares one backend action's identity and contract. `inputSchema` must
 * be a `z.object(...)` (not any `ZodTypeAny`) — the MCP tool surface needs
 * its raw shape, not just a validator, to describe each parameter to an
 * agent. Typed as `AnyZodObject` rather than a generic `ZodObject<TShape>`
 * — parameterizing this interface made `zodToJsonSchema`/the MCP SDK's
 * `registerTool` blow past TypeScript's type-instantiation depth limit.
 */
export interface ActionMetadata {
  key: string;
  name: string;
  description: string;
  category?: string;
  inputSchema: AnyZodObject;
  outputSchema?: ZodTypeAny;
}

export interface ActionHandler<TInput = unknown, TOutput = unknown> {
  run(input: TInput): Promise<TOutput>;
}

/**
 * Marks a NestJS provider as a backend action. `ActionsRegistry` discovers
 * every provider carrying this metadata on module init (via `DiscoveryService`,
 * the same mechanism `@nestjs/schedule`'s cron decorators use) — adding a
 * new action only means adding its class to `ActionsModule`'s `providers`,
 * nothing else has to know about it.
 */
export function RegisterAction(metadata: ActionMetadata): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(ACTION_METADATA_KEY, metadata, target);
  };
}
