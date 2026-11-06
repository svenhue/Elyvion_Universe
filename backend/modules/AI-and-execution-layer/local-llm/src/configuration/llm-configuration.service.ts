import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PublicLlmConfiguration,
  UpdateLlmConfiguration,
  validateBaseUrl,
} from './llm-configuration.dto';
import { LlmConfiguration, LlmConfigurationDocument } from './llm-configuration.schema';

const GLOBAL_SCOPE = 'global';

@Injectable()
export class LlmConfigurationService implements OnModuleInit {
  constructor(
    @InjectModel(LlmConfiguration.name)
    private readonly configurations: Model<LlmConfigurationDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = {
      scope: GLOBAL_SCOPE,
      baseUrl: validateBaseUrl(process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'),
      model: process.env.OLLAMA_MODEL ?? 'qwen3:4b',
      temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.2),
      numCtx: Number(process.env.OLLAMA_NUM_CTX ?? 8192),
    };
    if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) {
      throw new Error('OLLAMA_TEMPERATURE must be between 0 and 2.');
    }
    if (!Number.isInteger(config.numCtx) || config.numCtx < 1024 || config.numCtx > 131072) {
      throw new Error('OLLAMA_NUM_CTX must be between 1024 and 131072.');
    }
    await this.configurations.updateOne(
      { scope: GLOBAL_SCOPE },
      { $setOnInsert: config },
      { upsert: true },
    );
  }

  async getGlobal(): Promise<PublicLlmConfiguration> {
    const config = await this.configurations.findOne({ scope: GLOBAL_SCOPE }).lean();
    if (!config) throw new ServiceUnavailableException('Global LLM configuration is missing.');
    return {
      scope: 'global',
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      numCtx: config.numCtx,
      updatedAt: config.updatedAt,
    };
  }

  async updateGlobal(input: UpdateLlmConfiguration): Promise<PublicLlmConfiguration> {
    let baseUrl: string;
    try {
      baseUrl = validateBaseUrl(input.baseUrl);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Ollama URL is invalid.');
    }
    const config = await this.configurations.findOneAndUpdate(
      { scope: GLOBAL_SCOPE },
      { ...input, baseUrl },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    if (!config) throw new ServiceUnavailableException('Global LLM configuration could not be saved.');
    return {
      scope: 'global',
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      numCtx: config.numCtx,
      updatedAt: config.updatedAt,
    };
  }

  async complete(body: Record<string, unknown>): Promise<unknown> {
    const config = await this.getGlobal();
    const endpoint = `${config.baseUrl}/v1/chat/completions`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...body,
          model: config.model,
          temperature: config.temperature,
          options: {
            ...((body['options'] && typeof body['options'] === 'object')
              ? body['options'] as Record<string, unknown>
              : {}),
            num_ctx: config.numCtx,
          },
          stream: false,
        }),
        signal: AbortSignal.timeout(300_000),
      });
    } catch {
      throw new ServiceUnavailableException('Local LLM is unreachable.');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Local LLM request failed with HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch {
      throw new BadGatewayException('Local LLM returned an invalid response.');
    }
  }
}
