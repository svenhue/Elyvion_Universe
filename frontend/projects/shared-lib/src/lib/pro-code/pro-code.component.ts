import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, map, switchMap } from 'rxjs';
import { ApiClientService, ResponseEnvelope } from '../api/api-client.service';
import { AuthService } from '../auth/auth.service';
import { DynamicRendererComponent, DynamicElementDrop } from '../application-runner/rendering/dynamic-renderer.component';
import { DynamicAppSchema, DynamicComponentNode, isAbsolutelyPositioned } from '../application-runner/schema/dynamic-app-schema';
import { EventAction, EventActionType } from '../application-runner/schema/event-action';
import { DynamicAppService } from '../application-runner/service/dynamic-app.service';
import { AppStateService } from '../application-runner/state/app-state.service';
import { AppVariable, AppVariableType } from '../application-runner/state/app-variable';
import { UI_ELEMENT_CATALOG, UiElementDefinition } from './ui-element-catalog';
import { ElvVariableAutocompleteDirective } from '../ui/variable-autocomplete.directive';
import { AppOntologySyncService } from '../application-runner/ontology-sync.service';
import { FrontendActionsService } from '../actions/frontend-actions.service';

const EMPTY_SCHEMA: DynamicAppSchema = {
  id: 'default',
  name: 'Default App',
  version: '1.0.0',
  rootComponentId: 'root',
  components: [
    {
      id: 'root',
      type: 'element',
      element: 'main',
      attributes: { class: 'relative min-h-full w-full bg-white' },
      children: [],
    },
  ],
};

interface ConfiguredElement {
  id: string;
  name?: string;
  element?: string;
  position?: DynamicComponentNode['position'];
}

interface EditableEntry {
  key: string;
  value: unknown;
}

interface SaveRequest {
  applicationId: string;
  name: string;
  version: string;
  rootComponentId: string;
  components: DynamicComponentNode[];
  ontologySyncEnabled: boolean;
}

interface PreviewRequest {
  code: string;
  schema: DynamicAppSchema;
}

@Component({
  selector: 'elv-pro-code',
  standalone: true,
  imports: [DynamicRendererComponent, RouterLink, FormsModule, ElvVariableAutocompleteDirective],
  templateUrl: './pro-code.component.html',
})
export class ProCodeComponent implements OnInit, OnDestroy {
  readonly elements = UI_ELEMENT_CATALOG;
  readonly activePanel = signal<'elements' | 'schema' | 'history' | 'variables' | null>(null);
  readonly searchTerm = signal('');
  readonly schemaCode = signal(JSON.stringify(EMPTY_SCHEMA, null, 2));
  readonly schemaError = signal('');
  readonly loadError = signal('');
  readonly saveStatus = signal<'loading' | 'saving' | 'saved' | 'error'>('loading');
  readonly saveError = signal('');
  readonly configuredElements = signal<ConfiguredElement[]>([]);
  readonly previewSchema = signal<DynamicAppSchema>(EMPTY_SCHEMA);
  readonly selectedId = signal<string | null>(null);
  readonly history = signal<string[]>([JSON.stringify(EMPTY_SCHEMA)]);
  readonly historyIndex = signal(0);
  readonly codeLines = computed(() => this.schemaCode().split('\n').map((_, index) => index + 1));
  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(() => this.historyIndex() < this.history().length - 1);
  readonly filteredElements = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('de');
    return query
      ? this.elements.filter((element) =>
          `${element.title} ${element.name} ${element.description}`.toLocaleLowerCase('de').includes(query),
        )
      : this.elements;
  });
  readonly selectedNode = computed(
    () => this.previewSchema().components.find((node) => node.id === this.selectedId()) ?? null,
  );
  readonly selectedEntries = computed<EditableEntry[]>(() => {
    const node = this.selectedNode();
    if (!node) {
      return [];
    }
    const properties = node.attributes?.['properties'];
    const values = properties && typeof properties === 'object' && !Array.isArray(properties)
      ? properties as Record<string, unknown>
      : node.attributes ?? {};
    return Object.entries(values)
      .map(([key, value]) => ({ key, value }));
  });
  readonly selectedEvents = computed<[string, EventAction[]][]>(
    () => Object.entries(this.selectedNode()?.events ?? {}),
  );

  readonly newHandlerEvent = signal('click');
  readonly newHandlerActionType = signal<EventActionType>('set-variable');
  readonly newHandlerVariableName = signal('');
  readonly newHandlerVariableValue = signal('');
  readonly newHandlerTargetNodeId = signal('');
  readonly newHandlerTargetEvent = signal('click');
  readonly newHandlerFunctionName = signal('');
  readonly newHandlerScript = signal('');
  readonly newHandlerWorkflowKey = signal('');

  readonly otherNodes = computed(() =>
    this.previewSchema().components.filter((node) => node.id !== this.selectedId()),
  );

  protected readonly appState = inject(AppStateService);
  readonly variables = this.appState.variables$;
  readonly newVariableName = signal('');
  readonly newVariableType = signal<AppVariableType>('string');
  readonly newVariableValue = signal('');
  readonly editingVariable = signal<string | null>(null);

  readonly ontologySyncEnabled = signal(false);

  private readonly auth = inject(AuthService);
  private readonly dynamicAppService = inject(DynamicAppService);
  private readonly api = inject(ApiClientService);
  private readonly ontologySync = inject(AppOntologySyncService);
  private readonly frontendActions = inject(FrontendActionsService);
  private readonly saveRequests = new Subject<DynamicAppSchema>();
  private readonly historyRequests = new Subject<string>();
  private readonly previewRequests = new Subject<PreviewRequest>();
  /** Guards the three "live" actions below against running once this instance is gone — opening /pro-code again registers a fresh instance that takes over, but an agent calling one in between should get a clear error, not silently act on a dead component. */
  private isMounted = true;

  constructor() {
    this.syncConfiguredElements(EMPTY_SCHEMA);
    this.registerApplicationRunnerActions();
    this.previewRequests
      .pipe(debounceTime(150))
      .subscribe(({ code, schema }) => {
        if (this.schemaCode() === code) {
          this.previewSchema.set(schema);
        }
      });
    this.historyRequests
      .pipe(debounceTime(400))
      .subscribe((serialized) => {
        if (this.schemaCode() === serialized) {
          this.recordHistoryCode(serialized);
        }
      });
    this.saveRequests
      .pipe(
        debounceTime(600),
        switchMap((schema) => {
          this.saveStatus.set('saving');
          this.saveError.set('');
          const body: SaveRequest = {
            applicationId: 'default',
            name: schema.name,
            version: schema.version,
            rootComponentId: schema.rootComponentId,
            components: schema.components,
            ontologySyncEnabled: this.ontologySyncEnabled(),
          };
          return this.api.put<DynamicAppSchema>('app-config', '/configs/default', body).pipe(
            map((response: ResponseEnvelope<DynamicAppSchema>) => response.data),
            catchError((error: unknown) => {
              this.saveStatus.set('error');
              this.saveError.set(errorMessage(error, 'Die Anwendung konnte nicht in MongoDB gespeichert werden.'));
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe((saved) => {
        this.saveStatus.set('saved');
        if (this.ontologySyncEnabled()) {
          this.ontologySync.sync('default', saved).catch((error: unknown) => {
            console.error('[ProCode] Ontologie-Sync fehlgeschlagen:', error);
          });
        }
      });
  }

  ngOnInit(): void {
    const subject = this.auth.claims()?.['sub'];
    const userId = typeof subject === 'string' && subject.length ? subject : 'anonymous';
    this.dynamicAppService.loadApplication({ applicationId: 'default', userId }).subscribe({
      next: (schema) => {
        const normalized = normalizeSchema(schema);
        this.loadError.set('');
        this.ontologySyncEnabled.set(Boolean((schema as DynamicAppSchema & { ontologySyncEnabled?: boolean }).ontologySyncEnabled));
        this.loadSchema(normalized);
        this.saveStatus.set('saved');
      },
      error: (error: unknown) => {
        this.saveStatus.set('error');
        this.loadError.set(errorMessage(error, 'Die gespeicherte Anwendung konnte nicht geladen werden.'));
      },
    });
  }

  ngOnDestroy(): void {
    this.isMounted = false;
    this.saveRequests.complete();
    this.historyRequests.complete();
    this.previewRequests.complete();
  }

  /**
   * The Application Runner's own action exposure — "frontend-target"
   * because they only make sense while a human (or an agent, through the
   * same registry) actually has /pro-code open: they read/mutate this
   * component's own live, possibly-unsaved schema state, the same state
   * the canvas renders from, not the persisted one app-config's
   * get_app_schema/add_element/update_element actions operate on.
   */
  private registerApplicationRunnerActions(): void {
    this.frontendActions.register({
      key: 'read_current_app',
      name: 'Geöffnete Anwendung lesen',
      description: 'Liest das Schema der aktuell im App-Builder geöffneten Anwendung, inklusive ungespeicherter Änderungen.',
      category: 'application-runner',
      inputSchema: { type: 'object', properties: {} },
      run: async () => {
        this.assertMounted();
        const schema = this.parseSchema();
        if (!schema) throw new Error('Das aktuelle Schema ist syntaktisch ungültig.');
        return schema;
      },
    });

    this.frontendActions.register({
      key: 'add_element_live',
      name: 'Element live hinzufügen',
      description: 'Fügt der aktuell im App-Builder geöffneten Anwendung sofort sichtbar ein neues Element als Kind eines bestehenden Elements hinzu.',
      category: 'application-runner',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Id des Eltern-Elements.' },
          element: { type: 'object', description: 'Das neue ComponentNode-Objekt (id, type, element/name/text, attributes, …).' },
        },
        required: ['parentId', 'element'],
      },
      run: async (input: { parentId: string; element: DynamicComponentNode }) => {
        this.assertMounted();
        return this.addElementLive(input.parentId, input.element);
      },
    });

    this.frontendActions.register({
      key: 'update_element_live',
      name: 'Element live bearbeiten',
      description: 'Ändert Felder (inkl. attributes, die zusammengeführt statt ersetzt werden) eines Elements in der aktuell im App-Builder geöffneten Anwendung sofort sichtbar.',
      category: 'application-runner',
      inputSchema: {
        type: 'object',
        properties: {
          elementId: { type: 'string' },
          patch: { type: 'object', description: 'Zu ändernde Felder des Elements.' },
        },
        required: ['elementId', 'patch'],
      },
      run: async (input: { elementId: string; patch: Record<string, unknown> }) => {
        this.assertMounted();
        return this.updateElementLive(input.elementId, input.patch);
      },
    });
  }

  private assertMounted(): void {
    if (!this.isMounted) {
      throw new Error('Der App-Builder ist aktuell nicht geöffnet — bitte zuerst /pro-code öffnen.');
    }
  }

  private addElementLive(parentId: string, element: DynamicComponentNode): DynamicAppSchema {
    const schema = this.parseSchema();
    if (!schema) throw new Error('Das aktuelle Schema ist syntaktisch ungültig.');
    if (schema.components.some((node) => node.id === element.id)) {
      throw new Error(`Element "${element.id}" existiert bereits.`);
    }
    const parent = schema.components.find((node) => node.id === parentId);
    if (!parent) throw new Error(`Eltern-Element "${parentId}" wurde nicht gefunden.`);

    schema.components.push(element);
    parent.children = [...(parent.children ?? []), element.id];
    this.writeSchema(schema);
    return schema;
  }

  private updateElementLive(elementId: string, patch: Record<string, unknown>): DynamicAppSchema {
    const schema = this.parseSchema();
    if (!schema) throw new Error('Das aktuelle Schema ist syntaktisch ungültig.');
    const node = schema.components.find((candidate) => candidate.id === elementId);
    if (!node) throw new Error(`Element "${elementId}" wurde nicht gefunden.`);

    const patchedAttributes =
      patch['attributes'] && typeof patch['attributes'] === 'object'
        ? { ...(node.attributes ?? {}), ...(patch['attributes'] as Record<string, unknown>) }
        : node.attributes;
    Object.assign(node, patch, { id: elementId, attributes: patchedAttributes });
    this.writeSchema(schema);
    return schema;
  }

  togglePanel(panel: 'elements' | 'schema' | 'history' | 'variables'): void {
    this.activePanel.update((active) => active === panel ? null : panel);
  }

  // --- Global variables (left sidebar "Variablen" panel) ---

  startNewVariable(): void {
    this.editingVariable.set(null);
    this.newVariableName.set('');
    this.newVariableType.set('string');
    this.newVariableValue.set('');
  }

  editVariable(variable: AppVariable): void {
    this.editingVariable.set(variable.name);
    this.newVariableName.set(variable.name);
    this.newVariableType.set(variable.type);
    this.newVariableValue.set(
      typeof variable.value === 'object' ? JSON.stringify(variable.value) : String(variable.value ?? ''),
    );
  }

  setNewVariableType(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.newVariableType.set(event.target.value as AppVariableType);
    }
  }

  saveVariable(): void {
    const name = this.newVariableName().trim();
    if (!name) return;

    const type = this.newVariableType();
    let value: unknown;
    switch (type) {
      case 'number':
        value = Number(this.newVariableValue()) || 0;
        break;
      case 'boolean':
        value = this.newVariableValue() === 'true';
        break;
      case 'json':
      case 'list':
        try {
          value = JSON.parse(this.newVariableValue() || (type === 'list' ? '[]' : '{}'));
        } catch {
          this.schemaError.set('Variable: ungültiges JSON.');
          return;
        }
        break;
      default:
        // 'string' and 'theme' both hold a single scalar value — a theme
        // variable is just a color, so other variables can reference it
        // directly (`$accent`) instead of reaching into a nested object.
        value = this.newVariableValue();
    }

    this.appState.setVariable(name, type, value);
    this.startNewVariable();
  }

  removeVariable(name: string): void {
    this.appState.removeVariable(name);
    if (this.editingVariable() === name) {
      this.startNewVariable();
    }
  }

  variablePreview(variable: AppVariable): string {
    return typeof variable.value === 'object' ? JSON.stringify(variable.value) : String(variable.value);
  }

  // --- Event handlers (right sidebar, selected element) ---

  setNewHandlerActionType(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.newHandlerActionType.set(event.target.value as EventActionType);
    }
  }

  addEventHandler(): void {
    const eventName = this.newHandlerEvent().trim();
    if (!eventName) return;

    const type = this.newHandlerActionType();
    let action: EventAction;
    switch (type) {
      case 'set-variable':
        if (!this.newHandlerVariableName().trim()) return;
        action = {
          type,
          variableName: this.newHandlerVariableName().trim(),
          variableValue: this.coerceActionValue(this.newHandlerVariableValue()),
        };
        break;
      case 'trigger-event':
        if (!this.newHandlerTargetNodeId()) return;
        action = { type, targetNodeId: this.newHandlerTargetNodeId(), targetEvent: this.newHandlerTargetEvent().trim() || 'click' };
        break;
      case 'control-component':
        if (!this.newHandlerTargetNodeId() || !this.newHandlerFunctionName().trim()) return;
        action = { type, targetComponentId: this.newHandlerTargetNodeId(), functionName: this.newHandlerFunctionName().trim() };
        break;
      case 'run-script':
        if (!this.newHandlerScript().trim()) return;
        action = { type, script: this.newHandlerScript() };
        break;
      case 'call-service':
        action = { type };
        break;
      case 'run-workflow':
        if (!this.newHandlerWorkflowKey().trim()) return;
        action = { type, workflowKey: this.newHandlerWorkflowKey().trim() };
        break;
    }

    this.updateSelectedNode((node) => {
      const events = { ...(node.events ?? {}) };
      events[eventName] = [...(events[eventName] ?? []), action];
      node.events = events;
    });

    this.newHandlerVariableName.set('');
    this.newHandlerVariableValue.set('');
    this.newHandlerFunctionName.set('');
    this.newHandlerScript.set('');
    this.newHandlerWorkflowKey.set('');
  }

  removeEventHandler(eventName: string, index: number): void {
    this.updateSelectedNode((node) => {
      const events = { ...(node.events ?? {}) };
      const actions = (events[eventName] ?? []).filter((_, i) => i !== index);
      if (actions.length) {
        events[eventName] = actions;
      } else {
        delete events[eventName];
      }
      node.events = events;
    });
  }

  describeAction(action: EventAction): string {
    switch (action.type) {
      case 'set-variable':
        return `Setze $${action.variableName} = ${JSON.stringify(action.variableValue)}`;
      case 'trigger-event':
        return `Löst "${action.targetEvent}" auf ${action.targetNodeId} aus`;
      case 'control-component':
        return `Ruft ${action.functionName}() auf ${action.targetComponentId} auf`;
      case 'run-script':
        return 'Führt Skript aus';
      case 'call-service':
        return 'Service aufrufen (noch nicht implementiert)';
      case 'run-workflow':
        return `Startet Workflow "${action.workflowKey}"`;
    }
  }

  private coerceActionValue(raw: string): unknown {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
    return raw;
  }

  search(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchTerm.set(event.target.value);
    }
  }

  startPaletteDrag(event: DragEvent, element: UiElementDefinition): void {
    event.dataTransfer?.setData('application/x-elyvion-component', element.name);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  handleElementDrop(drop: DynamicElementDrop): void {
    if (this.saveStatus() === 'loading') {
      return;
    }
    const schema = this.parseSchema();
    if (!schema) {
      return;
    }

    if (drop.nodeId) {
      const node = schema.components.find((candidate) => candidate.id === drop.nodeId);
      if (!node || node.id === schema.rootComponentId) {
        return;
      }
      if (isAbsolutelyPositioned(node)) {
        // Opted into free placement via styles — drag just moves it by pixel.
        node.position = { ...node.position, x: drop.x, y: drop.y };
      } else {
        // Normal flow: dragging reorders the node among its siblings.
        this.reorderChildren(schema, node.id, drop.insertBeforeNodeId);
      }
      this.selectedId.set(node.id);
      this.writeSchema(schema);
      return;
    }

    const definition = this.elements.find((element) => element.name === drop.componentName);
    if (!definition) {
      return;
    }
    this.insertElement(schema, definition, drop.x, drop.y, drop.insertBeforeNodeId);
  }

  addElement(element: UiElementDefinition): void {
    if (this.saveStatus() === 'loading') {
      return;
    }
    const schema = this.parseSchema();
    if (!schema) {
      return;
    }
    this.insertElement(schema, element, 0, 0);
  }

  selectNode(id: string): void {
    this.selectedId.set(id);
  }

  removeElement(id: string): void {
    if (id === this.previewSchema().rootComponentId) {
      return;
    }
    const schema = this.parseSchema();
    if (!schema) {
      return;
    }
    const descendants = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of schema.components) {
        if (descendants.has(node.id)) {
          for (const childId of node.children ?? []) {
            if (!descendants.has(childId)) {
              descendants.add(childId);
              changed = true;
            }
          }
        }
      }
    }
    schema.components = schema.components.filter((node) => !descendants.has(node.id));
    for (const node of schema.components) {
      node.children = node.children?.filter((childId) => !descendants.has(childId));
    }
    this.selectedId.set(null);
    this.writeSchema(schema);
  }

  updateCode(event: Event): void {
    if (!(event.target instanceof HTMLTextAreaElement)) {
      return;
    }
    const code = event.target.value;
    this.schemaCode.set(code);
    this.validateSchema(code);
  }


  updateProperty(key: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    const entry = this.selectedEntries().find((candidate) => candidate.key === key);
    if (!entry) {
      return;
    }
    let value: unknown = target.value;
    if (typeof entry.value === 'number' && target instanceof HTMLInputElement) {
      if (target.value !== '' && !Number.isFinite(target.valueAsNumber)) {
        this.schemaError.set(`„${key}“ muss eine gültige Zahl sein.`);
        return;
      }
      value = target.value === '' ? 0 : target.valueAsNumber;
    } else if (typeof entry.value === 'boolean') {
      value = target.value === 'true';
    } else if (entry.value && typeof entry.value === 'object' && target instanceof HTMLTextAreaElement) {
      try {
        value = JSON.parse(target.value) as unknown;
      } catch {
        this.schemaError.set(`„${key}“ muss gültiges JSON enthalten.`);
        return;
      }
    }
    this.schemaError.set('');
    this.updateSelectedNode((node) => {
      const properties = node.attributes?.['properties'];
      if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
        const values = { ...properties as Record<string, unknown>, [key]: value };
        node.attributes = { ...node.attributes, properties: values };
      } else {
        node.attributes = { ...node.attributes, [key]: value };
      }
    });
  }

  undo(): void {
    if (!this.canUndo()) {
      return;
    }
    this.applyHistory(this.historyIndex() - 1);
  }

  redo(): void {
    if (!this.canRedo()) {
      return;
    }
    this.applyHistory(this.historyIndex() + 1);
  }

  restoreHistory(index: number): void {
    if (index !== this.historyIndex()) {
      this.applyHistory(index);
    }
  }

  historySummary(snapshot: string): string {
    try {
      const schema: unknown = JSON.parse(snapshot);
      return isDynamicAppSchema(schema)
        ? `${schema.components.length} Elemente · ${schema.name}`
        : 'Ungültiger Verlaufseintrag';
    } catch {
      return 'Ungültiger Verlaufseintrag';
    }
  }

  retryLoad(): void {
    this.loadError.set('');
    this.saveStatus.set('loading');
    this.ngOnInit();
  }

  titleFor(node: ConfiguredElement | DynamicComponentNode | null): string {
    if (!node) {
      return 'Element';
    }
    return this.elements.find((element) => element.name === node.name)?.title ?? node.element ?? node.name ?? 'Text';
  }

  entryValue(entry: EditableEntry): string {
    return entry.value && typeof entry.value === 'object'
      ? JSON.stringify(entry.value, null, 2)
      : String(entry.value ?? '');
  }

  entryType(entry: EditableEntry): string {
    if (typeof entry.value === 'boolean') {
      return 'boolean';
    }
    if (typeof entry.value === 'number') {
      return 'number';
    }
    if (entry.value && typeof entry.value === 'object') {
      return 'json';
    }
    return 'text';
  }

  saveNow(): void {
    const schema = this.parseSchema();
    if (schema) {
      this.saveRequests.next(schema);
    }
  }

  toggleOntologySync(): void {
    this.ontologySyncEnabled.update((enabled) => !enabled);
    this.saveNow();
  }

  private insertElement(
    schema: DynamicAppSchema,
    element: UiElementDefinition,
    x: number,
    y: number,
    insertBeforeNodeId?: string,
  ): void {
    const root = schema.components.find((node) => node.id === schema.rootComponentId);
    if (!root) {
      this.schemaError.set('Das rootComponentId verweist auf kein vorhandenes Schema-Element.');
      return;
    }
    const id = `${element.name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    // Rendered in normal document flow by default — `x`/`y` are only ever
    // used once this node's styles opt into `position: absolute`/`fixed`.
    schema.components.push({
      id,
      type: 'component',
      name: element.name,
      attributes: { properties: defaultProperties(element.name) },
      position: { x, y, order: 0 },
      children: [],
    });
    root.children = [...(root.children ?? []), id];
    this.reorderChildren(schema, id, insertBeforeNodeId);
    this.selectedId.set(id);
    this.writeSchema(schema);
  }

  /**
   * Moves `movingId` to just before `insertBeforeNodeId` among its
   * parent's children (or to the end, when omitted), then renumbers every
   * sibling's `position.order` so document flow and `order` stay in sync.
   * `movingId`'s parent is found by searching `children` rather than
   * passed in, since the canvas only supports dropping onto the root.
   */
  private reorderChildren(schema: DynamicAppSchema, movingId: string, insertBeforeNodeId?: string): void {
    const parent = schema.components.find((node) => node.children?.includes(movingId));
    if (!parent?.children) {
      return;
    }
    const siblings = parent.children.filter((id) => id !== movingId);
    const insertIndex = insertBeforeNodeId ? siblings.indexOf(insertBeforeNodeId) : -1;
    if (insertIndex === -1) {
      siblings.push(movingId);
    } else {
      siblings.splice(insertIndex, 0, movingId);
    }
    parent.children = siblings;

    siblings.forEach((id, index) => {
      const node = schema.components.find((candidate) => candidate.id === id);
      if (node) {
        node.position = { ...node.position, x: node.position?.x ?? 0, y: node.position?.y ?? 0, order: index + 1 };
      }
    });
  }

  private updateSelectedNode(update: (node: DynamicComponentNode) => void): void {
    const id = this.selectedId();
    if (!id) {
      return;
    }
    const schema = this.parseSchema();
    const node = schema?.components.find((candidate) => candidate.id === id);
    if (!schema || !node) {
      return;
    }
    update(node);
    this.writeSchema(schema);
  }

  private loadSchema(schema: DynamicAppSchema): void {
    const code = JSON.stringify(schema, null, 2);
    this.schemaCode.set(code);
    this.previewSchema.set(schema);
    this.schemaError.set('');
    this.syncConfiguredElements(schema);
    this.history.set([code]);
    this.historyIndex.set(0);
    this.selectedId.set(null);
  }

  private parseSchema(): DynamicAppSchema | null {
    try {
      const parsed: unknown = JSON.parse(this.schemaCode());
      if (!isDynamicAppSchema(parsed)) {
        this.schemaError.set('Das JSON muss id, name, version, components und eine gültige rootComponentId enthalten.');
        return null;
      }
      this.schemaError.set('');
      return parsed;
    } catch {
      this.schemaError.set('Das JSON ist syntaktisch ungültig. Bitte korrigiere den Code, bevor du Elemente änderst.');
      return null;
    }
  }

  private validateSchema(code: string): void {
    try {
      const parsed: unknown = JSON.parse(code);
      if (!isDynamicAppSchema(parsed)) {
        this.schemaError.set('Das JSON muss id, name, version, components und eine gültige rootComponentId enthalten.');
        return;
      }
      this.schemaError.set('');
      this.previewRequests.next({ code, schema: parsed });
      this.syncConfiguredElements(parsed);
      this.selectedId.update((id) => id && parsed.components.some((node) => node.id === id) ? id : null);
      this.historyRequests.next(JSON.stringify(parsed, null, 2));
      this.saveRequests.next(parsed);
    } catch {
      this.schemaError.set('Das JSON ist syntaktisch ungültig.');
    }
  }

  private writeSchema(schema: DynamicAppSchema): void {
    const code = JSON.stringify(schema, null, 2);
    this.schemaCode.set(code);
    this.schemaError.set('');
    this.previewSchema.set(schema);
    this.syncConfiguredElements(schema);
    this.recordHistory(schema);
    this.saveRequests.next(schema);
  }

  private recordHistory(schema: DynamicAppSchema): void {
    this.recordHistoryCode(JSON.stringify(schema, null, 2));
  }

  private recordHistoryCode(serialized: string): void {
    const current = this.history();
    if (current[this.historyIndex()] === serialized) {
      return;
    }
    const next = [...current.slice(0, this.historyIndex() + 1), serialized];
    this.history.set(next);
    this.historyIndex.set(next.length - 1);
  }

  private applyHistory(index: number): void {
    const serialized = this.history()[index];
    const schema: unknown = JSON.parse(serialized);
    if (!isDynamicAppSchema(schema)) {
      this.schemaError.set('Der gespeicherte Verlaufseintrag enthält kein gültiges Anwendungsschema.');
      return;
    }
    this.historyIndex.set(index);
    this.schemaCode.set(serialized);
    this.previewSchema.set(schema);
    this.schemaError.set('');
    this.syncConfiguredElements(schema);
    this.saveRequests.next(schema);
  }

  private syncConfiguredElements(schema: DynamicAppSchema): void {
    this.configuredElements.set(
      schema.components
        .filter((node) => node.id !== schema.rootComponentId)
        .map((node) => ({ id: node.id, name: node.name, element: node.element, position: node.position })),
    );
  }
}

function normalizeSchema(schema: DynamicAppSchema): DynamicAppSchema {
  const backendSchema = schema as DynamicAppSchema & { applicationId?: string };
  return {
    ...backendSchema,
    id: backendSchema.id || backendSchema.applicationId || 'default',
    components: backendSchema.components.map((node) => ({
      ...node,
      type: node.type ?? (node.name ? 'component' : node.element ? 'element' : 'text'),
    })),
  };
}

function isDynamicAppSchema(value: unknown): value is DynamicAppSchema {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('version' in value) ||
    typeof value.version !== 'string' ||
    !('rootComponentId' in value) ||
    typeof value.rootComponentId !== 'string' ||
    !('components' in value) ||
    !Array.isArray(value.components)
  ) {
    return false;
  }
  return value.components.every(
    (node: unknown) =>
      typeof node === 'object' &&
      node !== null &&
      'id' in node &&
      typeof node.id === 'string' &&
      (!('type' in node) || ['component', 'element', 'text'].includes(String(node.type))) &&
      (!('children' in node) || (Array.isArray(node.children) && node.children.every((id) => typeof id === 'string'))),
  ) && value.components.some((node: DynamicComponentNode) => node.id === value.rootComponentId);
}

function defaultProperties(name: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    button: { label: 'Button', variant: 'primary', className: 'rounded-lg bg-indigo-600 px-4 py-2 text-white', styles: {} },
    card: { title: 'Card', className: 'rounded-xl border border-slate-200 bg-white p-5', styles: {} },
    'text-input': { label: 'Text Input', placeholder: 'Enter text', className: 'w-64', styles: {} },
    textarea: { label: 'Textarea', placeholder: 'Enter text', className: 'w-64', styles: {} },
    checkbox: { label: 'Checkbox', className: '', styles: {} },
    select: { label: 'Select', placeholder: 'Choose an option', options: [], className: 'w-48', styles: {} },
    toggle: { label: 'Toggle', className: '', styles: {} },
    slider: { min: 0, max: 100, value: 50, className: 'w-48', styles: {} },
    badge: { label: 'Badge', tone: 'neutral', className: '', styles: {} },
    alert: { message: 'Alert message', tone: 'info', className: 'w-80', styles: {} },
    avatar: { initials: 'A', className: '', styles: {} },
    spinner: { label: 'Loading', className: '', styles: {} },
    progress: { value: 60, label: 'Progress', className: 'w-64', styles: {} },
    tooltip: { text: 'Tooltip', className: '', styles: {} },
    modal: { title: 'Dialog', className: '', styles: {} },
    tabs: { items: [{ label: 'Tab 1', value: 'tab-1' }, { label: 'Tab 2', value: 'tab-2' }], className: '', styles: {} },
    accordion: { title: 'Accordion', className: 'w-80', styles: {} },
    dropdown: { label: 'Dropdown', options: [], className: '', styles: {} },
    pagination: { pageCount: 5, className: '', styles: {} },
    divider: { className: 'w-64', styles: {} },
    skeleton: { width: '12rem', height: '1rem', className: '', styles: {} },
    'form-field': { label: 'Form Field', hint: 'Enter a value', className: 'w-64', styles: {} },
  };
  return defaults[name] ?? {};
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} ${error.message}`;
  }
  return fallback;
}
