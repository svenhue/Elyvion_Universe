import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { envelope, requireAuthorization } from '@elyvion/shared';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { updateLlmConfigurationSchema } from './llm-configuration.dto';
import { LlmConfigurationService } from './llm-configuration.service';

@Controller()
export class LlmConfigurationController {
  constructor(private readonly configuration: LlmConfigurationService) {}

  @Get('configurations')
  async list(@Req() request: Request) {
    await authorizeAdmin(request, 'ai.llm.read');
    return envelope([await this.configuration.getGlobal()]);
  }

  @Patch('configurations/global')
  async update(@Body() body: unknown, @Req() request: Request) {
    const parsed = updateLlmConfigurationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    await authorizeAdmin(request, 'ai.llm.configure');
    return envelope(await this.configuration.updateGlobal(parsed.data));
  }

  @Get('configuration')
  async get(@Req() request: Request) {
    await authorizeAdmin(request, 'ai.llm.read');
    return envelope(await this.configuration.getGlobal());
  }

  @Post('v1/chat/completions')
  async complete(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    await authorizeService(authorization);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('An LLM chat completion request is required.');
    }
    return this.configuration.complete(body as Record<string, unknown>);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'local-llm' };
  }
}

async function authorizeService(authorization: string | undefined): Promise<void> {
  const tokenFile = process.env.LOCAL_LLM_SERVICE_TOKEN_FILE;
  if (!tokenFile || !authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedException('Internal LLM service credentials are required.');
  }
  let expected: string;
  try {
    expected = (await readFile(tokenFile, 'utf8')).trim();
  } catch {
    throw new UnauthorizedException('Internal LLM service credentials are unavailable.');
  }
  const provided = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (!expected || expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new UnauthorizedException('Invalid internal LLM service credentials.');
  }
}

async function authorizeAdmin(request: Request, action: string): Promise<void> {
  const tenantId = process.env.LOCAL_LLM_ADMIN_TENANT_ID?.trim();
  if (!tenantId) throw new BadRequestException('Platform LLM admin tenant is not configured.');
  await requireAuthorization({
    authorization: request.headers.authorization,
    tenantId,
    action,
    resource: {
      type: 'local-llm',
      id: 'global',
      attributes: { scope: 'global' },
    },
    requestId: requestId(request),
  });
}

function requestId(request: Request): string | undefined {
  const id = request.headers['x-correlation-id'];
  return typeof id === 'string' ? id : undefined;
}
