import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { createRuleSchema, executeRuleSchema, updateRuleSchema } from './dto/rules.dto';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.rules.create(parsed.data));
  }

  @Get()
  async list() {
    return envelope(await this.rules.list());
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return envelope(await this.rules.findOne(key));
  }

  @Patch(':key')
  async update(@Param('key') key: string, @Body() body: unknown) {
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.rules.update(key, parsed.data));
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.rules.remove(key);
    return envelope({ removed: true });
  }

  @Post(':key/execute')
  async execute(@Param('key') key: string, @Body() body: unknown) {
    const parsed = executeRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.rules.execute(key, parsed.data.input));
  }
}
