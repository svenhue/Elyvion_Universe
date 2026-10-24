import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { checkAuthorization, envelope, logEvent } from '@elyvion/shared';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ActionMetadata } from './action.types';
import { ActionsRegistry } from './actions.registry';
import { registerFrontendActionSchema, registerRemoteActionSchema } from './dto/actions.dto';
import { FrontendActionsService } from './frontend-actions.service';
import { RemoteActionsService } from './remote-actions.service';

const LOGGING_URL = process.env.LOGGING_URL ?? 'http://localhost:3018';
const SECURITY_URL = process.env.SECURITY_URL ?? 'http://localhost:3022';

interface SubjectContext {
  subjectId?: string;
  subjectType?: 'user' | 'agent';
}

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

  /**
   * The one place every backend action actually runs (in-process or
   * remote-proxied) — so it's also the one place that logs every call,
   * success or failure, instead of each action's own implementation
   * having to remember to ("eigentlich sollte wirklich alles geloggt
   * werden"), AND the one place that checks "darf der Agent/Benutzer
   * das?" against `security` before running, for whichever actions
   * declare a `requiredPermission` ("jede Action muss exposen, welche
   * Berechtigung erforderlich ist"). `FrontendActionsService.execute`
   * does both the same way for frontend-target actions, on the browser
   * side. Subject identity comes from headers, not the body, so it
   * never collides with the action's own input shape — see
   * `x-subject-id`/`x-subject-type`.
   */
  @Post('execute/:key')
  async execute(
    @Param('key') key: string,
    @Body() body: unknown,
    @Headers('x-subject-id') subjectId?: string,
    @Headers('x-subject-type') subjectType?: 'user' | 'agent',
  ) {
    const subject: SubjectContext = { subjectId, subjectType };

    const entry = this.registry.get(key);
    if (entry) {
      await this.assertAuthorized(key, entry.metadata.requiredPermission, subject);
      const parsed = entry.metadata.inputSchema.safeParse(body ?? {});
      if (!parsed.success) {
        throw new BadRequestException(parsed.error.issues);
      }
      try {
        const output = await entry.handler.run(parsed.data);
        void this.logExecution(key, 'info', parsed.data, output);
        return envelope(output);
      } catch (error) {
        void this.logExecution(key, 'error', parsed.data, undefined, error);
        throw error;
      }
    }

    const remoteEntry = await this.remoteActions.findOne(key);
    if (remoteEntry) {
      await this.assertAuthorized(key, remoteEntry.requiredPermission, subject);
      try {
        const output = await this.remoteActions.execute(remoteEntry, (body ?? {}) as Record<string, unknown>);
        void this.logExecution(key, 'info', body, output);
        return envelope(output);
      } catch (error) {
        void this.logExecution(key, 'error', body, undefined, error);
        throw error;
      }
    }

    const frontendEntry = await this.frontendActions.findOne(key);
    if (frontendEntry) {
      throw new BadRequestException(
        `Action "${key}" läuft im Frontend und kann nicht vom Backend ausgeführt werden.`,
      );
    }
    throw new NotFoundException(`Action "${key}" wurde nicht gefunden.`);
  }

  private async assertAuthorized(
    actionKey: string,
    requiredPermission: string | undefined,
    subject: SubjectContext,
  ): Promise<void> {
    if (!requiredPermission) return;
    const result = await checkAuthorization({ securityUrl: SECURITY_URL, requiredPermission, ...subject });
    if (!result.allowed) {
      void this.logExecution(actionKey, 'error', subject, undefined, `Autorisierung verweigert: ${result.reason}`);
      throw new ForbiddenException(`Nicht autorisiert für Action "${actionKey}": ${result.reason}`);
    }
  }

  private async logExecution(
    actionKey: string,
    level: 'info' | 'error',
    input: unknown,
    output?: unknown,
    error?: unknown,
  ): Promise<void> {
    await logEvent({
      loggingUrl: LOGGING_URL,
      source: 'actions-engine',
      level,
      message: level === 'info' ? `Action "${actionKey}" ausgeführt.` : `Action "${actionKey}" fehlgeschlagen.`,
      actionKey,
      context: { input, output, error: error instanceof Error ? error.message : error ? String(error) : undefined },
    });
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
