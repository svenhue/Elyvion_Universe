import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { createLogSchema, listLogsQuerySchema } from './dto/logs.dto';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.logs.create(parsed.data));
  }

  @Get()
  async list(@Query() query: unknown) {
    const parsed = listLogsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.logs.list(parsed.data));
  }
}
