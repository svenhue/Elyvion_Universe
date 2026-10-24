import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { DataService } from './data.service';

@Controller('data')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get(':entity')
  async list(@Param('entity') entity: string) {
    return envelope(await this.data.list(entity));
  }

  @Post(':entity')
  async create(@Param('entity') entity: string, @Body() body: unknown) {
    return envelope(await this.data.create(entity, body));
  }

  @Get(':entity/:id')
  async findOne(@Param('entity') entity: string, @Param('id') id: string) {
    return envelope(await this.data.get(entity, id));
  }

  @Patch(':entity/:id')
  async update(@Param('entity') entity: string, @Param('id') id: string, @Body() body: unknown) {
    return envelope(await this.data.update(entity, id, body));
  }

  @Delete(':entity/:id')
  async remove(@Param('entity') entity: string, @Param('id') id: string) {
    await this.data.remove(entity, id);
    return envelope({ removed: true });
  }
}
