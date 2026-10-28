import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { recordVersionSchema } from './dto/versions.dto';
import { VersionsService } from './versions.service';

@Controller('versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Post()
  async record(@Body() body: unknown) {
    const parsed = recordVersionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.versions.record(parsed.data));
  }

  @Get()
  async history(@Query('resourceType') resourceType: string, @Query('resourceKey') resourceKey: string) {
    return envelope(await this.versions.history(resourceType, resourceKey));
  }

  /**
   * Same lookup as `GET /versions?resourceType=&resourceKey=`, but with
   * both as path segments instead of query params — the remote-action
   * proxy drops the request body (where query-string fields would come
   * from) for GET calls, so an action needs its required fields in the
   * path's `{param}` placeholders instead. See `get_object_history` in
   * main.ts.
   */
  @Get(':resourceType/:resourceKey/history')
  async historyByPath(@Param('resourceType') resourceType: string, @Param('resourceKey') resourceKey: string) {
    return envelope(await this.versions.history(resourceType, resourceKey));
  }

  @Get(':resourceType/:resourceKey/latest')
  async latest(@Param('resourceType') resourceType: string, @Param('resourceKey') resourceKey: string) {
    return envelope(await this.versions.latest(resourceType, resourceKey));
  }

  @Get(':resourceType/:resourceKey/:version')
  async getVersion(
    @Param('resourceType') resourceType: string,
    @Param('resourceKey') resourceKey: string,
    @Param('version') version: string,
  ) {
    return envelope(await this.versions.getVersion(resourceType, resourceKey, Number(version)));
  }
}
