import { Controller, Get } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { RegistryCacheService } from './registry/registry-cache.service';

@Controller()
export class AppController {
  constructor(private readonly registryCache: RegistryCacheService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'gateway' };
  }

  @Get('modules')
  modules() {
    return envelope(this.registryCache.all());
  }
}
