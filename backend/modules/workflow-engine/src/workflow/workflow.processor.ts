import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { readPath, resolveTemplate } from './resolve-template';
import { WORKFLOW_QUEUE, WorkflowJobData } from './workflow.constants';
import { WorkflowDefinitionBody, WorkflowStep } from './workflow-schema';

/**
 * Executes one workflow step per job — the unit BullMQ retries/backs off
 * on failure. Every attempt is written to `WorkflowStepRun` before and
 * after running, so a run's full history survives a crash mid-step, and
 * a step that opts into `onError` gets its compensation branch enqueued
 * instead of just failing the run outright (the saga pattern).
 */
@Processor(WORKFLOW_QUEUE)
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);
  private readonly registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3010';

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WORKFLOW_QUEUE) private readonly queue: Queue<WorkflowJobData>,
  ) {
    super();
  }

  async process(job: Job<WorkflowJobData>): Promise<void> {
    const { runId, stepId } = job.data;

    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId }, include: { workflow: true } });
    if (!run) {
      this.logger.warn(`Run "${runId}" no longer exists — dropping job for step "${stepId}".`);
      return;
    }
    const body = run.workflow.definition as unknown as WorkflowDefinitionBody;
    const step = body.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      this.logger.error(`Step "${stepId}" not found in workflow "${run.workflow.key}".`);
      return;
    }

    const context = run.context as Record<string, unknown>;
    const stepRun = await this.prisma.workflowStepRun.create({
      data: { runId, stepId, status: 'running', input: context as object, attempt: job.attemptsMade + 1 },
    });

    try {
      const output = await this.executeStep(step, context);
      // Every step's raw output lands under `steps.<id>` (reachable as
      // `$context.steps.step1.body...`, for chaining http/service calls);
      // `set-variable` additionally writes its resolved value to the
      // user-chosen `variableName`, so later steps can reference it by name.
      let nextContext = context;
      if (output !== undefined) {
        nextContext = {
          ...context,
          steps: { ...((context['steps'] as Record<string, unknown>) ?? {}), [step.id]: output },
        };
      }
      if (step.type === 'set-variable') {
        nextContext = { ...nextContext, [step.variableName]: output };
      }

      await this.prisma.$transaction([
        this.prisma.workflowStepRun.update({
          where: { id: stepRun.id },
          data: { status: 'succeeded', output: (output ?? null) as object, finishedAt: new Date() },
        }),
        this.prisma.workflowRun.update({ where: { id: runId }, data: { context: nextContext as object } }),
      ]);

      const branches = this.nextStepIds(step, nextContext);
      if (branches.length === 0) {
        await this.prisma.workflowRun.update({
          where: { id: runId },
          data: { status: 'succeeded', finishedAt: new Date() },
        });
        return;
      }
      await this.queue.addBulk(
        branches.map((nextStepId) => ({
          name: 'run-step',
          data: { runId, stepId: nextStepId },
          opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.workflowStepRun.update({
        where: { id: stepRun.id },
        data: { status: 'failed', error: message, finishedAt: new Date() },
      });

      if (step.onError?.length) {
        this.logger.warn(`Step "${step.id}" failed, running its onError branch: ${message}`);
        await this.queue.addBulk(
          step.onError.map((compensationStepId) => ({
            name: 'run-step',
            data: { runId, stepId: compensationStepId, compensating: true },
            opts: { attempts: 1 },
          })),
        );
        return;
      }

      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', error: message, finishedAt: new Date() },
      });
      throw error;
    }
  }

  private nextStepIds(step: WorkflowStep, context: Record<string, unknown>): string[] {
    if (step.type === 'condition') {
      const actual = readPath(context, step.path.replace(/^\$context\./, ''));
      return (actual === step.equals ? step.whenTrue : step.next) ?? [];
    }
    if (step.type === 'parallel') {
      return step.branches;
    }
    return step.next ?? [];
  }

  private async executeStep(step: WorkflowStep, context: Record<string, unknown>): Promise<unknown> {
    switch (step.type) {
      case 'set-variable':
        return resolveTemplate(step.value, context);

      case 'delay':
        await new Promise((resolve) => setTimeout(resolve, step.milliseconds));
        return undefined;

      case 'condition':
        return undefined;

      case 'parallel':
        return undefined;

      case 'http-request': {
        const url = resolveTemplate(step.url, context) as string;
        const body = step.body ? resolveTemplate(step.body, context) : undefined;
        const response = await fetch(url, {
          method: step.method,
          headers: { 'content-type': 'application/json', ...(step.headers ?? {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, body: await safeJson(response) };
      }

      case 'call-service': {
        const moduleInfo = await this.lookupModule(step.serviceName);
        const prefix = moduleInfo.routePrefix === '/' ? '' : moduleInfo.routePrefix;
        const url = `${moduleInfo.baseUrl}${prefix}${step.path}`;
        const body = step.body ? resolveTemplate(step.body, context) : undefined;
        const response = await fetch(url, {
          method: step.method ?? 'GET',
          headers: { 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, body: await safeJson(response) };
      }
    }
  }

  private async lookupModule(name: string): Promise<{ baseUrl: string; routePrefix: string }> {
    const response = await fetch(`${this.registryUrl}/modules/${name}`);
    if (!response.ok) {
      throw new Error(`Service "${name}" is not registered.`);
    }
    const envelope = (await response.json()) as { data: { baseUrl: string; routePrefix: string } };
    return envelope.data;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
