import Anthropic from '@anthropic-ai/sdk';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Thin wrapper around the Anthropic SDK — the only LLM provider this talks
 * to for now (a provider abstraction isn't worth it until a second
 * provider is actually needed). Missing `ANTHROPIC_API_KEY` is a 503, not
 * a stack trace from deep inside the SDK — a dev environment without a
 * key configured should get a clear "why" the first time it's used.
 */
@Injectable()
export class LlmService {
  private readonly client: Anthropic | null;
  private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async complete(history: LlmMessage[]): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY ist nicht gesetzt — der Chat kann noch nicht mit einem LLM sprechen.',
      );
    }
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: history.map((message) => ({ role: message.role, content: message.content })),
    });
    const block = response.content[0];
    return block?.type === 'text' ? block.text : '';
  }
}
