import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { addMemberSchema, createSolutionSchema } from './dto/solutions.dto';
import { SolutionsService } from './solutions.service';

@Controller('solutions')
export class SolutionsController {
  constructor(private readonly solutions: SolutionsService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createSolutionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.solutions.create(parsed.data));
  }

  @Get()
  async list() {
    return envelope(await this.solutions.list());
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return envelope(await this.solutions.findOne(key));
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.solutions.remove(key);
    return envelope({ removed: true });
  }

  @Post(':key/members')
  async addMember(@Param('key') key: string, @Body() body: unknown) {
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.solutions.addMember(key, parsed.data));
  }

  @Delete(':key/members/:resourceType/:resourceKey')
  async removeMember(
    @Param('key') key: string,
    @Param('resourceType') resourceType: string,
    @Param('resourceKey') resourceKey: string,
  ) {
    return envelope(await this.solutions.removeMember(key, resourceType, resourceKey));
  }
}
