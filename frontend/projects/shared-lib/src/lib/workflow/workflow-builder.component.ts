import { JsonPipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ActionDescriptor } from '../actions/action-schema';
import { ActionsApiService } from '../actions/actions-api.service';
import { ElvVariableAutocompleteDirective } from '../ui/variable-autocomplete.directive';
import { WorkflowApiService, WorkflowDefinitionRecord, toRunState } from './workflow-api.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowRunState, WorkflowStep, WorkflowStepType } from './workflow-schema';

/** The fields a step can send a connection out from — each maps to one of its array-valued fields. */
type PortKey = 'next' | 'onError' | 'whenTrue' | 'branches';

/** Canvas node box size — fixed, so port/edge geometry can be computed without measuring the DOM. */
const NODE_WIDTH = 192;
const NODE_HEIGHT = 84;

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
  x: number;
  y: number;
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
  actionKey: string;
  input: string;
}

function blankDraft(id: string, type: WorkflowStepType = 'set-variable', x = 40, y = 40): StepDraft {
  return {
    id,
    type,
    x,
    y,
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
    actionKey: '',
    input: '',
  };
}

function draftFromStep(step: WorkflowStep, index: number): StepDraft {
  const draft = blankDraft(
    step.id,
    step.type,
    step.position?.x ?? 40 + (index % 3) * (NODE_WIDTH + 64),
    step.position?.y ?? 40 + Math.floor(index / 3) * (NODE_HEIGHT + 80),
  );
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
    case 'action':
      draft.actionKey = step.actionKey;
      draft.input = step.input !== undefined ? stringify(step.input) : '';
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
  { value: 'action', label: 'Action' },
  { value: 'condition', label: 'Condition' },
  { value: 'delay', label: 'Delay' },
  { value: 'parallel', label: 'Parallel' },
];

const BACKEND_STEP_TYPES: { value: WorkflowStepType; label: string }[] = [
  { value: 'set-variable', label: 'Set Variable' },
  { value: 'http-request', label: 'HTTP Request' },
  { value: 'call-service', label: 'Call Service' },
  { value: 'action', label: 'Action' },
  { value: 'condition', label: 'Condition' },
  { value: 'delay', label: 'Delay' },
  { value: 'parallel', label: 'Parallel' },
];

interface PortDef {
  key: PortKey;
  label: string;
  colorVar: string;
}

const DEFAULT_PORTS: PortDef[] = [
  { key: 'next', label: 'Next', colorVar: '#64748b' },
  { key: 'onError', label: 'Error', colorVar: '#e11d48' },
];
const CONDITION_PORTS: PortDef[] = [
  { key: 'whenTrue', label: 'True', colorVar: '#16a34a' },
  { key: 'next', label: 'False', colorVar: '#64748b' },
  { key: 'onError', label: 'Error', colorVar: '#e11d48' },
];
const PARALLEL_PORTS: PortDef[] = [
  { key: 'branches', label: 'Branch', colorVar: '#4f46e5' },
  { key: 'onError', label: 'Error', colorVar: '#e11d48' },
];

function portsFor(type: WorkflowStepType): PortDef[] {
  if (type === 'condition') return CONDITION_PORTS;
  if (type === 'parallel') return PARALLEL_PORTS;
  return DEFAULT_PORTS;
}

interface Point {
  x: number;
  y: number;
}

interface Edge {
  id: string;
  from: Point;
  to: Point;
  colorVar: string;
}

interface NodeDragState {
  id: string;
  canvasLeft: number;
  canvasTop: number;
  offsetX: number;
  offsetY: number;
}

interface PortDragState {
  stepId: string;
  portKey: PortKey;
  canvasLeft: number;
  canvasTop: number;
  from: Point;
  x: number;
  y: number;
}

@Component({
  selector: 'elv-workflow-builder',
  standalone: true,
  imports: [FormsModule, RouterLink, ElvVariableAutocompleteDirective, JsonPipe],
  templateUrl: './workflow-builder.component.html',
})
export class WorkflowBuilderComponent implements OnInit {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly workflowRunner = inject(WorkflowRunnerService);
  private readonly actionsApi = inject(ActionsApiService);
  private readonly canvasRef = viewChild<ElementRef<HTMLElement>>('canvasEl');

  readonly workflows = signal<WorkflowDefinitionRecord[]>([]);
  readonly availableActions = signal<ActionDescriptor[]>([]);
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
  readonly selectedStepId = signal<string | null>(null);

  readonly nodeWidth = NODE_WIDTH;
  readonly nodeHeight = NODE_HEIGHT;
  readonly stepTypeOptions = computed(() =>
    this.target() === 'backend' ? BACKEND_STEP_TYPES : FRONTEND_STEP_TYPES,
  );
  readonly selectedStep = computed(() => this.steps().find((step) => step.id === this.selectedStepId()) ?? null);
  readonly selectedStepPorts = computed(() => (this.selectedStep() ? portsFor(this.selectedStep()!.type) : []));

  private readonly nodeDrag = signal<NodeDragState | null>(null);
  private readonly portDrag = signal<PortDragState | null>(null);
  readonly pendingEdge = computed(() => {
    const drag = this.portDrag();
    return drag ? { x1: drag.from.x, y1: drag.from.y, x2: drag.x, y2: drag.y } : null;
  });

  readonly edges = computed<Edge[]>(() => {
    const steps = this.steps();
    const byId = new Map(steps.map((step) => [step.id, step]));
    const result: Edge[] = [];
    for (const step of steps) {
      const ports = portsFor(step.type);
      ports.forEach((port, portIndex) => {
        for (const targetId of idList((step as unknown as Record<string, string>)[port.key] ?? '')) {
          const target = byId.get(targetId);
          if (!target) continue;
          result.push({
            id: `${step.id}:${port.key}:${targetId}`,
            from: portPoint(step, portIndex, ports.length),
            to: { x: target.x + NODE_WIDTH / 2, y: target.y },
            colorVar: port.colorVar,
          });
        }
      });
    }
    return result;
  });

  ngOnInit(): void {
    this.loadWorkflows();
    this.actionsApi.list().subscribe({ next: (actions) => this.availableActions.set(actions) });
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
    this.selectedStepId.set('step-1');
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
    this.selectedStepId.set(record.definition.steps[0]?.id ?? null);
    this.runResult.set(null);
    this.saveError.set('');
  }

  setTarget(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.target.set(event.target.value as 'frontend' | 'backend');
    }
  }

  selectStep(id: string): void {
    this.selectedStepId.set(id);
  }

  addStep(): void {
    const steps = this.steps();
    const id = `step-${steps.length + 1}`;
    const last = steps[steps.length - 1];
    const x = last ? last.x + 40 : 40;
    const y = last ? last.y + NODE_HEIGHT + 56 : 40;
    const draft = blankDraft(id, this.stepTypeOptions()[0].value, x, y);
    this.steps.update((current) => [...current, draft]);
    this.selectedStepId.set(id);
  }

  removeStep(id: string): void {
    this.steps.update((steps) =>
      steps
        .filter((step) => step.id !== id)
        .map((step) => ({
          ...step,
          next: removeId(step.next, id),
          onError: removeId(step.onError, id),
          whenTrue: removeId(step.whenTrue, id),
          branches: removeId(step.branches, id),
        })),
    );
    if (this.selectedStepId() === id) {
      this.selectedStepId.set(null);
    }
  }

  updateStep(id: string, patch: Partial<StepDraft>): void {
    this.steps.update((steps) => steps.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  setStepType(id: string, event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.updateStep(id, { type: event.target.value as WorkflowStepType });
    }
  }

  portsForStep(step: StepDraft): PortDef[] {
    return portsFor(step.type);
  }

  selectedActionDescription(step: StepDraft): string | null {
    if (step.type !== 'action' || !step.actionKey) return null;
    return this.availableActions().find((action) => action.key === step.actionKey)?.description ?? null;
  }

  nodeSummary(step: StepDraft): string {
    switch (step.type) {
      case 'set-variable':
        return `${step.variableName || '…'} = ${step.value || '…'}`;
      case 'run-script':
        return 'Skript';
      case 'call-backend-workflow':
        return `→ ${step.workflowKey || '…'}`;
      case 'http-request':
        return `${step.method} ${step.url || '…'}`;
      case 'call-service':
        return `${step.serviceName || '…'}${step.path || ''}`;
      case 'condition':
        return `${step.conditionPath || '…'} == ${step.equals || '…'}`;
      case 'delay':
        return `${step.milliseconds || 0} ms`;
      case 'parallel':
        return `${idList(step.branches).length} Branches`;
      case 'action':
        return step.actionKey || '…';
    }
  }

  // --- Canvas: dragging a node to reposition it ---

  startNodeDrag(event: PointerEvent, step: StepDraft): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.nodeDrag.set({
      id: step.id,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      offsetX: event.clientX - rect.left - step.x,
      offsetY: event.clientY - rect.top - step.y,
    });
    this.selectStep(step.id);
  }

  onNodePointerMove(event: PointerEvent): void {
    const drag = this.nodeDrag();
    if (!drag) return;
    const x = Math.max(0, event.clientX - drag.canvasLeft - drag.offsetX);
    const y = Math.max(0, event.clientY - drag.canvasTop - drag.offsetY);
    this.updateStep(drag.id, { x, y });
  }

  onNodePointerUp(): void {
    this.nodeDrag.set(null);
  }

  // --- Canvas: dragging a connection from a port ---

  startPortDrag(event: PointerEvent, step: StepDraft, portKey: PortKey, portIndex: number, portCount: number): void {
    event.stopPropagation();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const from = portPoint(step, portIndex, portCount);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.portDrag.set({
      stepId: step.id,
      portKey,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      from,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  onPortPointerMove(event: PointerEvent): void {
    const drag = this.portDrag();
    if (!drag) return;
    this.portDrag.set({ ...drag, x: event.clientX - drag.canvasLeft, y: event.clientY - drag.canvasTop });
  }

  onPortPointerUp(event: PointerEvent): void {
    const drag = this.portDrag();
    this.portDrag.set(null);
    if (!drag) return;
    const x = event.clientX - drag.canvasLeft;
    const y = event.clientY - drag.canvasTop;
    const target = this.steps().find((step) => step.id !== drag.stepId && pointInNode(x, y, step));
    if (target) {
      this.addConnection(drag.stepId, drag.portKey, target.id);
    }
  }

  private addConnection(stepId: string, portKey: PortKey, targetId: string): void {
    const step = this.steps().find((candidate) => candidate.id === stepId);
    if (!step) return;
    const current = idList((step as unknown as Record<string, string>)[portKey] ?? '');
    if (current.includes(targetId)) return;
    this.updateStep(stepId, { [portKey]: [...current, targetId].join(', ') } as Partial<StepDraft>);
  }

  connectionsFor(step: StepDraft, portKey: PortKey): string[] {
    return idList((step as unknown as Record<string, string>)[portKey] ?? '');
  }

  removeConnection(stepId: string, portKey: PortKey, targetId: string): void {
    const step = this.steps().find((candidate) => candidate.id === stepId);
    if (!step) return;
    const current = idList((step as unknown as Record<string, string>)[portKey] ?? '');
    this.updateStep(stepId, { [portKey]: current.filter((id) => id !== targetId).join(', ') } as Partial<StepDraft>);
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
      position: { x: draft.x, y: draft.y },
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
      case 'action':
        if (!draft.actionKey.trim()) throw new Error(`Step "${draft.id}": Action fehlt.`);
        return {
          ...base,
          type: 'action',
          actionKey: draft.actionKey.trim(),
          input: draft.input.trim() ? coerce(draft.input) : undefined,
        };
    }
  }
}

function portPoint(step: StepDraft, index: number, count: number): Point {
  const spacing = NODE_WIDTH / (count + 1);
  return { x: step.x + spacing * (index + 1), y: step.y + NODE_HEIGHT };
}

function pointInNode(x: number, y: number, step: StepDraft): boolean {
  return x >= step.x && x <= step.x + NODE_WIDTH && y >= step.y && y <= step.y + NODE_HEIGHT;
}

function removeId(raw: string, id: string): string {
  return idList(raw)
    .filter((candidate) => candidate !== id)
    .join(', ');
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
