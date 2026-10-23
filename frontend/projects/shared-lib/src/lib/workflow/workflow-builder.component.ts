import { JsonPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ElvVariableAutocompleteDirective } from '../ui/variable-autocomplete.directive';
import { WorkflowApiService, WorkflowDefinitionRecord, toRunState } from './workflow-api.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowRunState, WorkflowStep, WorkflowStepType } from './workflow-schema';

/**
 * A step mid-edit in the builder — every field is a plain string (or
 * comma-separated list), same loose-then-coerce pattern pro-code's own
 * event-handler form uses, since a discriminated union's required fields
 * can't all be populated while the author is still choosing the type.
 * `toStep()` turns one of these into a real `WorkflowStep` on save.
 */
interface StepDraft {
  id: string;
  type: WorkflowStepType;
  next: string;
  onError: string;
  variableName: string;
  value: string;
  script: string;
  workflowKey: string;
  context: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  serviceName: string;
  path: string;
  conditionPath: string;
  equals: string;
  whenTrue: string;
  milliseconds: string;
  branches: string;
}

function blankDraft(id: string, type: WorkflowStepType = 'set-variable'): StepDraft {
  return {
    id,
    type,
    next: '',
    onError: '',
    variableName: '',
    value: '',
    script: '',
    workflowKey: '',
    context: '',
    method: 'GET',
    url: '',
    headers: '',
    body: '',
    serviceName: '',
    path: '',
    conditionPath: '',
    equals: '',
    whenTrue: '',
    milliseconds: '1000',
    branches: '',
  };
}

function draftFromStep(step: WorkflowStep): StepDraft {
  const draft = blankDraft(step.id, step.type);
  draft.next = (step.next ?? []).join(', ');
  draft.onError = (step.onError ?? []).join(', ');
  switch (step.type) {
    case 'set-variable':
      draft.variableName = step.variableName;
      draft.value = stringify(step.value);
      break;
    case 'run-script':
      draft.script = step.script;
      break;
    case 'call-backend-workflow':
      draft.workflowKey = step.workflowKey;
      draft.context = step.context !== undefined ? stringify(step.context) : '';
      break;
    case 'http-request':
      draft.method = step.method;
      draft.url = step.url;
      draft.headers = step.headers ? stringify(step.headers) : '';
      draft.body = step.body !== undefined ? stringify(step.body) : '';
      break;
    case 'call-service':
      draft.serviceName = step.serviceName;
      draft.path = step.path;
      draft.method = step.method ?? 'GET';
      draft.body = step.body !== undefined ? stringify(step.body) : '';
      break;
    case 'condition':
      draft.conditionPath = step.path;
      draft.equals = stringify(step.equals);
      draft.whenTrue = (step.whenTrue ?? []).join(', ');
      break;
    case 'delay':
      draft.milliseconds = String(step.milliseconds);
      break;
    case 'parallel':
      draft.branches = step.branches.join(', ');
      break;
  }
  return draft;
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** `"true"`/`"false"`/a number/JSON → their real type; everything else (incl. `$name` refs) stays a string. */
function coerce(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  if (/^[[{]/.test(raw.trim())) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through to plain string */
    }
  }
  return raw;
}

function idList(raw: string): string[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const FRONTEND_STEP_TYPES: { value: WorkflowStepType; label: string }[] = [
  { value: 'set-variable', label: 'Set Variable' },
  { value: 'http-request', label: 'HTTP Request' },
  { value: 'run-script', label: 'Run Script' },
  { value: 'call-backend-workflow', label: 'Call Backend Workflow' },
  { value: 'condition', label: 'Condition' },
  { value: 'delay', label: 'Delay' },
  { value: 'parallel', label: 'Parallel' },
];

const BACKEND_STEP_TYPES: { value: WorkflowStepType; label: string }[] = [
  { value: 'set-variable', label: 'Set Variable' },
  { value: 'http-request', label: 'HTTP Request' },
  { value: 'call-service', label: 'Call Service' },
  { value: 'condition', label: 'Condition' },
  { value: 'delay', label: 'Delay' },
  { value: 'parallel', label: 'Parallel' },
];

@Component({
  selector: 'elv-workflow-builder',
  standalone: true,
  imports: [FormsModule, RouterLink, ElvVariableAutocompleteDirective, JsonPipe],
  templateUrl: './workflow-builder.component.html',
})
export class WorkflowBuilderComponent implements OnInit {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly workflowRunner = inject(WorkflowRunnerService);

  readonly workflows = signal<WorkflowDefinitionRecord[]>([]);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly saving = signal(false);
  readonly running = signal(false);
  readonly runResult = signal<WorkflowRunState | null>(null);

  readonly editingKey = signal<string | null>(null);
  readonly editingVersion = signal<number | null>(null);
  readonly key = signal('');
  readonly name = signal('');
  readonly target = signal<'frontend' | 'backend'>('frontend');
  readonly startStepId = signal('');
  readonly steps = signal<StepDraft[]>([blankDraft('step-1')]);

  readonly stepTypeOptions = computed(() =>
    this.target() === 'backend' ? BACKEND_STEP_TYPES : FRONTEND_STEP_TYPES,
  );

  ngOnInit(): void {
    this.loadWorkflows();
  }

  loadWorkflows(): void {
    this.workflowApi.list().subscribe({
      next: (records) => this.workflows.set(records),
      error: (error: unknown) => this.loadError.set(errorMessage(error, 'Workflows konnten nicht geladen werden.')),
    });
  }

  newWorkflow(): void {
    this.editingKey.set(null);
    this.editingVersion.set(null);
    this.key.set('');
    this.name.set('');
    this.target.set('frontend');
    this.startStepId.set('step-1');
    this.steps.set([blankDraft('step-1')]);
    this.runResult.set(null);
    this.saveError.set('');
  }

  editWorkflow(record: WorkflowDefinitionRecord): void {
    this.editingKey.set(record.key);
    this.editingVersion.set(record.version);
    this.key.set(record.key);
    this.name.set(record.name);
    this.target.set(record.target);
    this.startStepId.set(record.definition.startStepId);
    this.steps.set(record.definition.steps.map(draftFromStep));
    this.runResult.set(null);
    this.saveError.set('');
  }

  setTarget(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.target.set(event.target.value as 'frontend' | 'backend');
    }
  }

  addStep(): void {
    const id = `step-${this.steps().length + 1}`;
    this.steps.update((steps) => [...steps, blankDraft(id, this.stepTypeOptions()[0].value)]);
  }

  removeStep(id: string): void {
    this.steps.update((steps) => steps.filter((step) => step.id !== id));
  }

  updateStep(id: string, patch: Partial<StepDraft>): void {
    this.steps.update((steps) => steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  setStepType(id: string, event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.updateStep(id, { type: event.target.value as WorkflowStepType });
    }
  }

  async save(): Promise<void> {
    const key = this.key().trim();
    const name = this.name().trim();
    const startStepId = this.startStepId().trim();
    if (!key || !name || !startStepId) {
      this.saveError.set('Key, Name und Start-Step sind erforderlich.');
      return;
    }

    let steps: WorkflowStep[];
    try {
      steps = this.steps().map((draft) => this.toStep(draft));
    } catch (error) {
      this.saveError.set(errorMessage(error, 'Ungültiger Step.'));
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    try {
      const saved = await firstValueFrom(
        this.workflowApi.save({ key, name, target: this.target(), startStepId, steps }),
      );
      this.loadWorkflows();
      this.editWorkflow(saved);
    } catch (error) {
      this.saveError.set(errorMessage(error, 'Workflow konnte nicht gespeichert werden.'));
    } finally {
      this.saving.set(false);
    }
  }

  async run(): Promise<void> {
    const key = this.key().trim();
    if (!key) return;
    this.running.set(true);
    this.runResult.set(null);
    try {
      if (this.target() === 'frontend') {
        const steps = this.steps().map((draft) => this.toStep(draft));
        const result = await this.workflowRunner.run({
          key,
          name: this.name(),
          target: 'frontend',
          startStepId: this.startStepId(),
          steps,
        });
        this.runResult.set(result);
      } else {
        const run = await firstValueFrom(this.workflowApi.run(key));
        // Backend steps run asynchronously on the queue — give them a
        // moment, then show whatever the run's state is by then (its
        // step list is also visible on this same page if it needs longer).
        await new Promise((resolve) => setTimeout(resolve, 800));
        const finished = await firstValueFrom(this.workflowApi.getRun(run.id));
        this.runResult.set(toRunState(finished));
      }
    } catch (error) {
      this.runResult.set({ status: 'failed', context: {}, steps: [], error: errorMessage(error, 'Lauf fehlgeschlagen.') });
    } finally {
      this.running.set(false);
    }
  }

  private toStep(draft: StepDraft): WorkflowStep {
    const base = {
      id: draft.id,
      next: idList(draft.next),
      onError: idList(draft.onError),
    };
    switch (draft.type) {
      case 'set-variable':
        if (!draft.variableName.trim()) throw new Error(`Step "${draft.id}": Variablenname fehlt.`);
        return { ...base, type: 'set-variable', variableName: draft.variableName.trim(), value: coerce(draft.value) };
      case 'run-script':
        if (!draft.script.trim()) throw new Error(`Step "${draft.id}": Skript fehlt.`);
        return { ...base, type: 'run-script', script: draft.script };
      case 'call-backend-workflow':
        if (!draft.workflowKey.trim()) throw new Error(`Step "${draft.id}": Workflow-Key fehlt.`);
        return {
          ...base,
          type: 'call-backend-workflow',
          workflowKey: draft.workflowKey.trim(),
          context: draft.context.trim() ? coerce(draft.context) : undefined,
        };
      case 'http-request':
        if (!draft.url.trim()) throw new Error(`Step "${draft.id}": URL fehlt.`);
        return {
          ...base,
          type: 'http-request',
          method: (draft.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url: draft.url.trim(),
          headers: draft.headers.trim() ? (JSON.parse(draft.headers) as Record<string, string>) : undefined,
          body: draft.body.trim() ? coerce(draft.body) : undefined,
        };
      case 'call-service':
        if (!draft.serviceName.trim() || !draft.path.trim()) {
          throw new Error(`Step "${draft.id}": Service-Name und Pfad sind erforderlich.`);
        }
        return {
          ...base,
          type: 'call-service',
          serviceName: draft.serviceName.trim(),
          path: draft.path.trim(),
          method: (draft.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          body: draft.body.trim() ? coerce(draft.body) : undefined,
        };
      case 'condition':
        if (!draft.conditionPath.trim()) throw new Error(`Step "${draft.id}": Pfad fehlt.`);
        return {
          ...base,
          type: 'condition',
          path: draft.conditionPath.trim(),
          equals: coerce(draft.equals),
          whenTrue: idList(draft.whenTrue),
        };
      case 'delay':
        return { ...base, type: 'delay', milliseconds: Number(draft.milliseconds) || 0 };
      case 'parallel': {
        const branches = idList(draft.branches);
        if (!branches.length) throw new Error(`Step "${draft.id}": mindestens ein Branch ist erforderlich.`);
        return { ...base, type: 'parallel', branches };
      }
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
