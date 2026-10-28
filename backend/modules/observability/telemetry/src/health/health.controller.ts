import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { registerTargetSchema } from './dto/health.dto';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('status')
  async status() {
    return envelope(await this.health.getStatus());
  }

  @Get('targets/:id/history')
  async history(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit ?? 100) || 100, 500);
    return envelope(await this.health.getHistory(id, parsedLimit));
  }

  @Post('targets')
  async register(@Body() body: unknown) {
    const parsed = registerTargetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.health.registerTarget(parsed.data));
  }

  @Delete('targets/:name')
  async remove(@Param('name') name: string) {
    await this.health.removeTarget(name);
    return envelope({ removed: true });
  }
}
