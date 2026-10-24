import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ActionHandler, RegisterAction } from '../action.types';

const inputSchema = z.object({
  message: z.string().min(1),
  level: z.enum(['log', 'warn', 'error']).default('log'),
});
type Input = z.infer<typeof inputSchema>;

/** The simplest possible action — useful as a smoke test for the registry, workflows and MCP tool-calling without depending on any external system. */
@Injectable()
@RegisterAction({
  key: 'log_message',
  name: 'Nachricht loggen',
  description: 'Schreibt eine Nachricht ins Server-Log — nützlich zum Testen von Workflows und Agenten.',
  category: 'diagnostics',
  inputSchema,
})
export class LogMessageAction implements ActionHandler<Input, { logged: true }> {
  private readonly logger = new Logger(LogMessageAction.name);

  async run(input: Input): Promise<{ logged: true }> {
    this.logger[input.level](input.message);
    return { logged: true };
  }
}
