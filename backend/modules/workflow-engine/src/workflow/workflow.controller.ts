import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { WorkflowService } from './workflow.service';
import { createWorkflowSchema, startRunSchema } from './dto/workflow.dto';

@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('definitions')
  async list() {
    return envelope(await this.workflowService.listDefinitions());
  }

  @Post('definitions')
  async create(@Body() body: unknown) {
    const parsed = createWorkflowSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.workflowService.upsertDefinition(parsed.data));
  }

  @Get('definitions/:key')
  async findOne(@Param('key') key: string) {
    return envelope(await this.workflowService.findLatestDefinition(key));
  }

  @Post('definitions/:key/run')
  async run(@Param('key') key: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.workflowService.startRun(key, parsed.data.context));
  }

  @Get('runs/:runId')
  async findRun(@Param('runId') runId: string) {
    return envelope(await this.workflowService.findRun(runId));
  }
}
