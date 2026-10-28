import { All, Controller, Req, Res } from '@nestjs/common';
import { checkAuthorization, logEvent } from '@elyvion/shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ActionsRegistry } from '../actions.registry';
import { RemoteActionsService } from '../remote-actions.service';

const LOGGING_URL = process.env.LOGGING_URL ?? 'http://localhost:3030';
const SECURITY_URL = process.env.SECURITY_URL ?? 'http://localhost:3022';

interface SubjectContext {
  subjectId?: string;
  subjectType?: 'user' | 'agent';
}

/**
 * Remote actions only carry a JSON Schema (no zod instance crosses a
 * module boundary) — `registerTool` needs a zod raw shape, so these
 * register with this permissive catch-all shape instead of their precise
 * one. The owning module still validates the real input shape on its own
 * endpoint, so this only costs MCP clients a less specific tool
 * description, not correctness. Typed as `any` at the use site (not here)
 * to dodge the same TS2589 instantiation-depth issue `zodToJsonSchema`
 * hits elsewhere in this module — a known pathology of this SDK's deeply
 * generic signatures, not a sign anything here is actually wrong.
 */
const REMOTE_ACTION_TOOL_SHAPE = { input: z.record(z.string(), z.unknown()) };

/**
 * Exposes every action as an MCP tool — in-process ones (`ActionsRegistry`)
 * *and* remote ones another module registered (`RemoteActionsService`) —
 * the "MCP-ready" requirement, and the thing that lets `agent-engine`'s
 * agents call any module's actions through one connection. This is the
 * agent-facing side of "jede Aktion wird vorher geprüft, darf der Agent
 * das" — the same authorization + logging every call gets through
 * `ActionsController.execute` (the person-facing REST path), applied
 * here too so an agent calling via MCP can't bypass either. Stateless
 * mode (`sessionIdGenerator: undefined`): a fresh server+transport per
 * request instead of a long-lived session, which is fine here since
 * actions are cheap to look up and have no per-session state of their
 * own.
 */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly registry: ActionsRegistry,
    private readonly remoteActions: RemoteActionsService,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const subject: SubjectContext = {
      subjectId: req.headers['x-subject-id'] as string | undefined,
      subjectType: req.headers['x-subject-type'] as 'user' | 'agent' | undefined,
    };
    const server = await this.buildServer(subject);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  private async buildServer(subject: SubjectContext): Promise<McpServer> {
    const server = new McpServer({ name: 'elyvion-actions-engine', version: '0.1.0' });

    for (const metadata of this.registry.list()) {
      const entry = this.registry.get(metadata.key)!;
      server.registerTool(
        metadata.key,
        { title: metadata.name, description: metadata.description, inputSchema: metadata.inputSchema.shape },
        async (input: unknown) => {
          await assertAuthorized(metadata.key, metadata.requiredPermission, subject);
          try {
            const output = await entry.handler.run(input);
            void logExecution(metadata.key, 'info', input, output);
            return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
          } catch (error) {
            void logExecution(metadata.key, 'error', input, undefined, error);
            throw error;
          }
        },
      );
    }

    // Remote actions only carry a JSON Schema (no zod instance crosses a
    // module boundary) — `registerTool` needs a zod raw shape, so these
    // register with a permissive catch-all shape instead of their precise
    // one. The owning module still validates the real input shape on its
    // own endpoint, so this only costs MCP clients a less specific tool
    // description, not correctness.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registerTool = server.registerTool.bind(server) as (...args: any[]) => unknown;
    for (const action of await this.remoteActions.list()) {
      registerTool(
        action.key,
        { title: action.name, description: action.description, inputSchema: REMOTE_ACTION_TOOL_SHAPE },
        async (args: { input?: Record<string, unknown> }) => {
          await assertAuthorized(action.key, action.requiredPermission, subject);
          const entry = await this.remoteActions.findOne(action.key);
          if (!entry) throw new Error(`Action "${action.key}" wurde nicht gefunden.`);
          const input = args.input ?? (args as Record<string, unknown>);
          try {
            const output = await this.remoteActions.execute(entry, input);
            void logExecution(action.key, 'info', input, output);
            return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
          } catch (error) {
            void logExecution(action.key, 'error', input, undefined, error);
            throw error;
          }
        },
      );
    }

    return server;
  }
}

async function assertAuthorized(actionKey: string, requiredPermission: string | undefined, subject: SubjectContext): Promise<void> {
  if (!requiredPermission) return;
  const result = await checkAuthorization({ securityUrl: SECURITY_URL, requiredPermission, ...subject });
  if (!result.allowed) {
    void logExecution(actionKey, 'error', subject, undefined, `Autorisierung verweigert: ${result.reason}`);
    throw new Error(`Nicht autorisiert für Action "${actionKey}": ${result.reason}`);
  }
}

async function logExecution(actionKey: string, level: 'info' | 'error', input: unknown, output?: unknown, error?: unknown): Promise<void> {
  await logEvent({
    loggingUrl: LOGGING_URL,
    source: 'actions-engine-mcp',
    level,
    message: level === 'info' ? `Action "${actionKey}" via MCP ausgeführt.` : `Action "${actionKey}" via MCP fehlgeschlagen.`,
    actionKey,
    context: { input, output, error: error instanceof Error ? error.message : error ? String(error) : undefined },
  });
}
