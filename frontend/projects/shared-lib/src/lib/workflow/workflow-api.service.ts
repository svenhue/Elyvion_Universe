import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { WorkflowDefinition, WorkflowRunState, WorkflowStep } from './workflow-schema';

/** A stored workflow, exactly as the `workflow-engine` backend module returns it — see its Prisma `WorkflowDefinition` model. */
export interface WorkflowDefinitionRecord {
  id: string;
  key: string;
  version: number;
  name: string;
  target: 'frontend' | 'backend';
  definition: { startStepId: string; steps: WorkflowStep[] };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowApiStepRunRecord {
  id: string;
  runId: string;
  stepId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'compensated' | 'skipped';
  attempt: number;
  input?: unknown;
  output?: unknown;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'compensated';
  context: Record<string, unknown>;
  error?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  steps?: WorkflowApiStepRunRecord[];
}

export interface CreateWorkflowPayload {
  key: string;
  name: string;
  target: 'frontend' | 'backend';
  startStepId: string;
  steps: WorkflowStep[];
}

/**
 * Talks to the `workflow-engine` backend module — the single place both
 * `target: "frontend"` and `target: "backend"` workflow definitions are
 * authored and stored. Backend-target workflows are also *executed*
 * there (via `run()`); frontend-target ones are only stored there and
 * actually run in-browser by `WorkflowRunnerService`.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowApiService {
  private readonly api = inject(ApiClientService);
  private static readonly MODULE = 'workflow-engine';

  list(): Observable<WorkflowDefinitionRecord[]> {
    return this.api
      .get<WorkflowDefinitionRecord[]>(WorkflowApiService.MODULE, '/definitions')
      .pipe(map((response) => response.data));
  }

  get(key: string): Observable<WorkflowDefinitionRecord> {
    return this.api
      .get<WorkflowDefinitionRecord>(WorkflowApiService.MODULE, `/definitions/${key}`)
      .pipe(map((response) => response.data));
  }

  /** Fetch-and-check, for callers that just need to know whether a key exists (e.g. before offering to edit it). */
  async tryGet(key: string): Promise<WorkflowDefinitionRecord | null> {
    try {
      return await firstValueFrom(this.get(key));
    } catch {
      return null;
    }
  }

  /** Stores a new version of `payload.key` — editing an existing workflow always creates the next version, never overwrites one a run may still be using. */
  save(payload: CreateWorkflowPayload): Observable<WorkflowDefinitionRecord> {
    return this.api
      .post<WorkflowDefinitionRecord>(WorkflowApiService.MODULE, '/definitions', payload)
      .pipe(map((response) => response.data));
  }

  /** Starts a run on the backend — the right call for a `target: "backend"` workflow; a `target: "frontend"` one should run through `WorkflowRunnerService` instead. */
  run(key: string, context: Record<string, unknown> = {}): Observable<WorkflowRunRecord> {
    return this.api
      .post<WorkflowRunRecord>(WorkflowApiService.MODULE, `/definitions/${key}/run`, { context })
      .pipe(map((response) => response.data));
  }

  getRun(runId: string): Observable<WorkflowRunRecord> {
    return this.api
      .get<WorkflowRunRecord>(WorkflowApiService.MODULE, `/runs/${runId}`)
      .pipe(map((response) => response.data));
  }

  toDefinition(record: WorkflowDefinitionRecord): WorkflowDefinition {
    return {
      key: record.key,
      name: record.name,
      target: record.target,
      startStepId: record.definition.startStepId,
      steps: record.definition.steps,
    };
  }
}

/** Maps a `WorkflowRunRecord` (backend shape) onto the frontend's own `WorkflowRunState`, for a single shared "how did this run go" view. */
export function toRunState(record: WorkflowRunRecord): WorkflowRunState {
  return {
    status: record.status === 'succeeded' ? 'succeeded' : record.status === 'failed' ? 'failed' : 'running',
    context: record.context,
    error: record.error ?? undefined,
    steps: (record.steps ?? []).map((step) => ({
      stepId: step.stepId,
      status: step.status === 'succeeded' ? 'succeeded' : 'failed',
      output: step.output,
      error: step.error ?? undefined,
      startedAt: new Date(step.startedAt).getTime(),
      finishedAt: step.finishedAt ? new Date(step.finishedAt).getTime() : Date.now(),
    })),
  };
}
