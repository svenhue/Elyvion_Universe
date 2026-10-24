import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ActionMetadata } from './action.types';
import { ActionsRegistry } from './actions.registry';
import { registerFrontendActionSchema, registerRemoteActionSchema } from './dto/actions.dto';
import { FrontendActionsService } from './frontend-actions.service';
import { RemoteActionsService } from './remote-actions.service';

/**
 * `zodToJsonSchema`'s generic signature hits TS's type-instantiation depth
 * limit (TS2589) against any sufficiently real zod object type — a known
 * issue with this library (not specific to this schema). Only the untyped
 * `any` escape hatch avoids it; harmless here since the function's actual
 * job is a one-way runtime conversion to a plain JSON Schema object, not
 * something that needs static type-checking on its input.
 */
function inputJsonSchema(metadata: ActionMetadata): object {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodToJsonSchema(metadata.inputSchema as any);
}

@Controller()
export class ActionsController {
  constructor(
    private readonly registry: ActionsRegistry,
    private readonly frontendActions: FrontendActionsService,
    private readonly remoteActions: RemoteActionsService,
  ) {}

  @Get('actions')
  async list() {
    const backend = this.registry.list().map((metadata) => ({
      key: metadata.key,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      inputSchema: inputJsonSchema(metadata),
      target: 'backend' as const,
    }));
    const remote = await this.remoteActions.list();
    const frontend = await this.frontendActions.list();
    return envelope([...backend, ...remote, ...frontend]);
  }

  @Get('actions/:key')
  async findOne(@Param('key') key: string) {
    const backendEntry = this.registry.get(key);
    if (backendEntry) {
      return envelope({
        key: backendEntry.metadata.key,
        name: backendEntry.metadata.name,
        description: backendEntry.metadata.description,
        category: backendEntry.metadata.category,
        inputSchema: inputJsonSchema(backendEntry.metadata),
        target: 'backend' as const,
      });
    }
    const remoteEntry = await this.remoteActions.findOne(key);
    if (remoteEntry) {
      return envelope({
        key: remoteEntry.key,
        name: remoteEntry.name,
        description: remoteEntry.description,
        category: remoteEntry.category,
        inputSchema: remoteEntry.inputSchema,
        target: 'backend' as const,
      });
    }
    const frontendEntry = await this.frontendActions.findOne(key);
    if (!frontendEntry) {
      throw new NotFoundException(`Action "${key}" wurde nicht gefunden.`);
    }
    return envelope(frontendEntry);
  }

  @Post('execute/:key')
  async execute(@Param('key') key: string, @Body() body: unknown) {
    const entry = this.registry.get(key);
    if (entry) {
      const parsed = entry.metadata.inputSchema.safeParse(body ?? {});
      if (!parsed.success) {
        throw new BadRequestException(parsed.error.issues);
      }
      return envelope(await entry.handler.run(parsed.data));
    }

    const remoteEntry = await this.remoteActions.findOne(key);
    if (remoteEntry) {
      return envelope(await this.remoteActions.execute(remoteEntry, (body ?? {}) as Record<string, unknown>));
    }

    const frontendEntry = await this.frontendActions.findOne(key);
    if (frontendEntry) {
      throw new BadRequestException(
        `Action "${key}" läuft im Frontend und kann nicht vom Backend ausgeführt werden.`,
      );
    }
    throw new NotFoundException(`Action "${key}" wurde nicht gefunden.`);
  }

  @Post('frontend-actions')
  async registerFrontendAction(@Body() body: unknown) {
    const parsed = registerFrontendActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.frontendActions.upsert(parsed.data));
  }

  @Post('remote-actions')
  async registerRemoteAction(@Body() body: unknown) {
    const parsed = registerRemoteActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.remoteActions.upsert(parsed.data));
  }
}
