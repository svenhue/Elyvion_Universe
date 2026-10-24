import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { createDeploymentSchema, createTargetSchema } from './dto/deployments.dto';
import { DeploymentsService } from './deployments.service';

@Controller()
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Post('deployment-targets')
  async createTarget(@Body() body: unknown) {
    const parsed = createTargetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.deployments.createTarget(parsed.data));
  }

  @Get('deployment-targets')
  async listTargets() {
    return envelope(await this.deployments.listTargets());
  }

  @Post('deployments')
  async deploy(@Body() body: unknown) {
    const parsed = createDeploymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return envelope(await this.deployments.deploy(parsed.data));
  }

  @Get('deployments')
  async list() {
    return envelope(await this.deployments.list());
  }

  @Get('deployments/:id')
  async findOne(@Param('id') id: string) {
    return envelope(await this.deployments.findOne(id));
  }

  @Get('deployments/:id/status')
  async status(@Param('id') id: string) {
    return envelope(await this.deployments.getLiveStatus(id));
  }

  @Post('deployments/:id/stop')
  async stop(@Param('id') id: string) {
    return envelope(await this.deployments.stop(id));
  }
}
