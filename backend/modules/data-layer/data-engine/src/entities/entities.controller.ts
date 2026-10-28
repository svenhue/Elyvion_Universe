import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { createEntitySchema } from './dto/entities.dto';
import { EntityRegistryService } from './entity-registry.service';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly registry: EntityRegistryService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createEntitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.registry.define(parsed.data));
  }

  @Get()
  async list() {
    return envelope(await this.registry.list());
  }

  @Get(':name')
  async findOne(@Param('name') name: string) {
    return envelope(await this.registry.get(name));
  }

  @Delete(':name')
  async remove(@Param('name') name: string) {
    await this.registry.remove(name);
    return envelope({ removed: true });
  }
}
