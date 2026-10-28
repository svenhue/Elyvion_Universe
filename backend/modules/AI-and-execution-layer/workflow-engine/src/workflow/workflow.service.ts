import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/workflow.dto';
import { WORKFLOW_QUEUE, WorkflowJobData } from './workflow.constants';
import { WorkflowDefinitionBody } from './workflow-schema';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly queue: Queue<WorkflowJobData>,
  ) {}

  /** Stores a new version of `key` — a running instance always keeps executing the version it started with. */
  async upsertDefinition(dto: CreateWorkflowDto) {
    const latest = await this.prisma.workflowDefinition.findFirst({
      where: { key: dto.key },
      orderBy: { version: 'desc' },
    });
    const body: WorkflowDefinitionBody = {
      startStepId: dto.startStepId,
      steps: dto.steps as WorkflowDefinitionBody['steps'],
    };
    return this.prisma.workflowDefinition.create({
      data: {
        key: dto.key,
        version: (latest?.version ?? 0) + 1,
        name: dto.name,
        target: dto.target,
        definition: body as object,
      },
    });
  }

  async findLatestDefinition(key: string) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
    });
    if (!definition) {
      throw new NotFoundException(`No workflow registered under key "${key}".`);
    }
    return definition;
  }

  listDefinitions() {
    return this.prisma.workflowDefinition.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
  }

  /**
   * Starts a new run and enqueues its first step — the transaction
   * boundary opens here. The job only ever carries ids; the processor
   * re-reads the definition and the run's current context from Postgres
   * on every step, so retries and crash-recovery pick up exactly where
   * the last durable checkpoint left off.
   */
  async startRun(key: string, context: Record<string, unknown> = {}) {
    const definition = await this.findLatestDefinition(key);
    const body = definition.definition as unknown as WorkflowDefinitionBody;

    const run = await this.prisma.workflowRun.create({
      data: { workflowId: definition.id, status: 'running', context: context as object },
    });

    await this.queue.add(
      'run-step',
      { runId: run.id, stepId: body.startStepId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
    return run;
  }

  async findRun(runId: string) {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { steps: { orderBy: { startedAt: 'asc' } } },
    });
    if (!run) {
      throw new NotFoundException(`No workflow run "${runId}".`);
    }
    return run;
  }
}
