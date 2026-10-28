import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { AdaptersService } from './adapters.service';
import { createAdapterSchema, scheduleAdapterSchema, updateAdapterSchema } from './dto/adapters.dto';

@Controller('adapters')
export class AdaptersController {
  constructor(private readonly adapters: AdaptersService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.adapters.create(parsed.data));
  }

  @Get()
  async list() {
    return envelope(await this.adapters.list());
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return envelope(await this.adapters.findOne(id));
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.adapters.update(id, parsed.data));
  }

  @Patch(':id/schedule')
  async schedule(@Param('id') id: string, @Body() body: unknown) {
    const parsed = scheduleAdapterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.adapters.schedule(id, parsed.data.schedule));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.adapters.remove(id);
    return envelope({ removed: true });
  }

  @Post(':id/runs')
  async triggerRun(@Param('id') id: string) {
    return envelope(await this.adapters.triggerRun(id));
  }

  @Get(':id/runs')
  async listRuns(@Param('id') id: string) {
    return envelope(await this.adapters.listRuns(id));
  }
}
