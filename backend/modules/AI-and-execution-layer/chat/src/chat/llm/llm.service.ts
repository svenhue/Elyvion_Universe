import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import chat from 'ollama';
import { readFile } from 'node:fs/promises';
import { OllamaService } from './ollama.service';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class LlmService {

  constructor(private readonly ollamaService: OllamaService) {}

  private readonly endpoint = new URL(
    '/v1/chat/completions',
    process.env.LOCAL_LLM_URL ?? 'http://local-llm:9299',
  ).toString();

  async complete(history: LlmMessage[], stream: boolean = true): Promise<string | ReadableStream<Uint8Array>>  {
    const tokenFile = process.env.LOCAL_LLM_SERVICE_TOKEN_FILE;
    if (!tokenFile) {
      throw new ServiceUnavailableException('Local LLM service credentials are not configured.');
    }
    let token: string;
    try {
      token = (await readFile(tokenFile, 'utf8')).trim();
    } catch {
      throw new ServiceUnavailableException('Local LLM service credentials are unavailable.');
    }
    if (!token) throw new ServiceUnavailableException('Local LLM service credentials are empty.');

      if(!stream){
      let response: Response;
      try {
        response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: history }),
          signal: AbortSignal.timeout(300_000),
        });
      } catch (e) {
        throw new ServiceUnavailableException('Local LLM is unavailable.');
      }
      if (!response.ok) throw new ServiceUnavailableException('Local LLM request failed.');
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('choices' in result) || !Array.isArray(result.choices)) {
        throw new ServiceUnavailableException('Local LLM returned an invalid response.');
      }
      const first = result.choices[0];
      if (!first || typeof first !== 'object' || !('message' in first) || !first.message ||
        typeof first.message !== 'object' || !('content' in first.message) || typeof first.message.content !== 'string') {
        throw new ServiceUnavailableException('Local LLM returned an invalid response.');
      }
      return first.message.content;
    } 
    else {
      return this.ollamaService.complete(history, stream);
    }
  }
}
