import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { createIntegrationSchema, executeIntegrationActionSchema } from './dto/integrations.dto';
import { IntegrationsService } from './integrations.service';
import { ProviderRegistry } from './providers/provider-registry';

@Controller()
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly providers: ProviderRegistry,
  ) {}

  @Get('providers')
  listProviders() {
    return envelope(
      this.providers.list().map((provider) => ({
        key: provider.key,
        name: provider.name,
        connectionConfigSchema: provider.connectionConfigSchema,
        actions: provider.actions.map((action) => ({
          key: action.key,
          name: action.name,
          description: action.description,
          inputSchema: action.inputSchema,
        })),
      })),
    );
  }

  @Post('integrations')
  async create(@Body() body: unknown) {
    const parsed = createIntegrationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.integrations.create(parsed.data));
  }

  @Get('integrations')
  async list() {
    return envelope(await this.integrations.list());
  }

  @Get('integrations/:key')
  async findOne(@Param('key') key: string) {
    return envelope(await this.integrations.findOne(key));
  }

  @Delete('integrations/:key')
  async remove(@Param('key') key: string) {
    await this.integrations.remove(key);
    return envelope({ removed: true });
  }

  @Post('integrations/:key/actions/:actionKey/execute')
  async execute(@Param('key') key: string, @Param('actionKey') actionKey: string, @Body() body: unknown) {
    const parsed = executeIntegrationActionSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.integrations.executeAction(key, actionKey, parsed.data.input));
  }
}
