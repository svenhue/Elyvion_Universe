import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: process.env.MODULE_NAME ?? 'module-ts-template' };
  }
}
