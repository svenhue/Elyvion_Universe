import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { WorkflowService } from './workflow.service';
import {
  createWorkflowSchema,
  executeTaskSchema,
  startRunSchema,
} from './dto/workflow.dto';
import { WorkflowProcessor } from './workflow.processor';

@Controller()
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowProcessor: WorkflowProcessor,
  ) {}

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
    return envelope(
      await this.workflowService.startRun(key, parsed.data.context),
    );
  }

  @Get('runs/:runId')
  async findRun(@Param('runId') runId: string) {
    return envelope(await this.workflowService.findRun(runId));
  }

  @Post('tasks/execute')
  async executeTask(@Body() body: unknown, @Req() request: Request) {
    const expectedTaskToken = process.env.WORKFLOW_TASK_TOKEN;
    const providedTaskToken = request.headers['x-workflow-task-token'];
    if (!isTokenValid(expectedTaskToken, providedTaskToken)) {
      throw new ForbiddenException('Invalid workflow task token.');
    }
    if (!request.headers.authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A valid bearer token is required.');
    }
    const tenantId = request.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      throw new BadRequestException('x-tenant-id is required.');
    }

    const parsed = executeTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(
      await this.workflowProcessor.executeTask(
        parsed.data.step,
        parsed.data.context,
        {
          authorization: request.headers.authorization,
          tenantId,
          workspaceId: typeof request.headers['x-workspace-id'] === 'string'
            ? request.headers['x-workspace-id']
            : undefined,
          environmentId: typeof request.headers['x-environment-id'] === 'string'
            ? request.headers['x-environment-id']
            : undefined,
        },
      ),
    );
  }
}

function isTokenValid(
  expectedToken: string | undefined,
  providedToken: string | string[] | undefined,
): boolean {
  if (!expectedToken || typeof providedToken !== 'string') return false;
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
