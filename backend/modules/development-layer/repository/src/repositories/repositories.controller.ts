import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { addMemberSchema, createRepositorySchema } from './dto/repositories.dto';
import { RepositoriesService } from './repositories.service';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createRepositorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.repositories.create(parsed.data));
  }

  @Get()
  async list() {
    return envelope(await this.repositories.list());
  }

  /** Must come before `:key` — otherwise "copies" would be parsed as a repository key. */
  @Get('copies')
  async copiesOf(@Query('resourceType') resourceType: string, @Query('resourceKey') resourceKey: string) {
    if (!resourceType || !resourceKey) throw new BadRequestException('resourceType und resourceKey sind erforderlich.');
    return envelope(await this.repositories.copiesOf(resourceType, resourceKey));
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    return envelope(await this.repositories.findOne(key));
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.repositories.remove(key);
    return envelope({ removed: true });
  }

  @Post(':key/members')
  async addMember(@Param('key') key: string, @Body() body: unknown) {
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.repositories.addMember(key, parsed.data));
  }

  @Delete(':key/members/:resourceType/:resourceKey')
  async removeMember(
    @Param('key') key: string,
    @Param('resourceType') resourceType: string,
    @Param('resourceKey') resourceKey: string,
  ) {
    return envelope(await this.repositories.removeMember(key, resourceType, resourceKey));
  }
}
