import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ActionHandler, RegisterAction } from '../action.types';

const inputSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});
type Input = z.infer<typeof inputSchema>;

/** Stub — no SMTP/email provider is wired up yet, so this logs instead of sending. Swap the body for a real provider call once one exists; the action's contract (key, input shape) doesn't need to change. */
@Injectable()
@RegisterAction({
  key: 'send_email',
  name: 'E-Mail versenden',
  description: 'Sendet eine E-Mail an einen Empfänger.',
  category: 'communication',
  inputSchema,
})
export class SendEmailAction implements ActionHandler<Input, { sent: boolean }> {
  private readonly logger = new Logger(SendEmailAction.name);

  async run(input: Input): Promise<{ sent: boolean }> {
    this.logger.log(`[stub] send_email an=${input.to} betreff="${input.subject}"`);
    return { sent: true };
  }
}
