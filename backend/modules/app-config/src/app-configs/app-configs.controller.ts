import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { AppConfigsService } from './app-configs.service';
import {
  addElementSchema,
  resolveSchemaRequestSchema,
  updateElementSchema,
  upsertAppConfigSchema,
} from './dto/resolve-schema.dto';

@Controller()
export class AppConfigsController {
  constructor(private readonly appConfigsService: AppConfigsService) {}

  /** Matches DynamicAppService.loadApplication() in @elyvion/shared-lib. */
  @Post('schema')
  async resolveSchema(@Body() body: unknown) {
    const parsed = resolveSchemaRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    const config = await this.appConfigsService.resolve(parsed.data);
    return envelope(config);
  }

  @Get('configs')
  async findAll() {
    return envelope(await this.appConfigsService.findAll());
  }

  @Get('configs/:applicationId')
  async findOne(@Param('applicationId') applicationId: string) {
    return envelope(await this.appConfigsService.findOne(applicationId));
  }

  @Put('configs/:applicationId')
  async upsert(@Param('applicationId') applicationId: string, @Body() body: unknown) {
    const parsed = upsertAppConfigSchema.safeParse({ ...(body as object), applicationId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.appConfigsService.upsert(parsed.data));
  }

  @Delete('configs/:applicationId')
  @HttpCode(204)
  async remove(@Param('applicationId') applicationId: string) {
    await this.appConfigsService.remove(applicationId);
  }

  /** Exposed as the `add_element` action — see `main.ts`. */
  @Post('configs/:applicationId/elements')
  async addElement(@Param('applicationId') applicationId: string, @Body() body: unknown) {
    const parsed = addElementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.appConfigsService.addElement(applicationId, parsed.data));
  }

  /** Exposed as the `update_element` action — see `main.ts`. */
  @Patch('configs/:applicationId/elements/:elementId')
  async updateElement(
    @Param('applicationId') applicationId: string,
    @Param('elementId') elementId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateElementSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.appConfigsService.updateElement(applicationId, elementId, parsed.data.patch));
  }
}
