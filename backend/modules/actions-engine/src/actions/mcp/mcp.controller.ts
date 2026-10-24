import { All, Controller, Req, Res } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { ActionsRegistry } from '../actions.registry';

/**
 * Exposes every registered backend action as an MCP tool — the "MCP-ready"
 * requirement. Stateless mode (`sessionIdGenerator: undefined`): a fresh
 * server+transport per request instead of a long-lived session, which is
 * fine here since actions are cheap to look up and have no per-session
 * state of their own. An AI agent (this module's own agent-engine, or any
 * other MCP client) points at `/mcp` and gets the exact same action
 * catalog a human sees in the Actions panel or via `GET /actions`.
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly registry: ActionsRegistry) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const server = this.buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  private buildServer(): McpServer {
    const server = new McpServer({ name: 'elyvion-actions-engine', version: '0.1.0' });
    for (const metadata of this.registry.list()) {
      const entry = this.registry.get(metadata.key)!;
      server.registerTool(
        metadata.key,
        {
          title: metadata.name,
          description: metadata.description,
          inputSchema: metadata.inputSchema.shape,
        },
        async (input: unknown) => {
          const output = await entry.handler.run(input);
          return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
        },
      );
    }
    return server;
  }
}
