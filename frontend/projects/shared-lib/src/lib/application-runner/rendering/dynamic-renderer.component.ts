import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  EffectRef,
  EventEmitter,
  EnvironmentInjector,
  ElementRef,
  effect,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Type,
  ViewRef,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DYNAMIC_COMPONENT_REGISTRY } from '../registry/dynamic-component-registry';
import {
  DynamicAppSchema,
  DynamicComponentNode,
  isAbsolutelyPositioned,
  listDataSourceOf,
  listItemAliasOf,
} from '../schema/dynamic-app-schema';
import { EventAction } from '../schema/event-action';
import { AppStateService } from '../state/app-state.service';
import { parseVariableReference } from '../state/app-variable';
import { DataEngineApiService } from '../../data-engine/data-engine-api.service';
import { WorkflowApiService } from '../../workflow/workflow-api.service';
import { WorkflowRunnerService } from '../../workflow/workflow-runner.service';

interface RenderSession {
  views: ViewRef[];
  componentRefs: ComponentRef<unknown>[];
  effects: EffectRef[];
  /** Node id → its ComponentRef, for `control-component` actions and `trigger-event` lookups. */
  nodesById: Map<string, DynamicComponentNode>;
  componentRefsById: Map<string, ComponentRef<unknown>>;
  /** Per-item `AppStateService` variables a `list` node created for this render pass — torn down with the rest of the session, see `renderListNode`. */
  transientVariableNames: string[];
}

export interface DynamicElementDrop {
  x: number;
  y: number;
  nodeId?: string;
  componentName?: string;
  /**
   * Id of the sibling to insert/move the dropped node before, based on
   * where the pointer landed among the root's direct children.
   * `undefined` means "insert at the end". Used for normal document-flow
   * placement; a node that opts into absolute positioning ignores this and
   * uses `x`/`y` instead.
   */
  insertBeforeNodeId?: string;
}

/**
 * Renders component, native-element and text nodes from a DynamicAppSchema.
 */
@Component({
  selector: 'elv-dynamic-renderer',
  standalone: true,
  template: '',
  host: { class: 'block h-full min-h-full' },
})
export class DynamicRendererComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) schema!: DynamicAppSchema;
  @Input() componentId?: string;
  @Output() readonly nodeDropped = new EventEmitter<DynamicElementDrop>();
  @Output() readonly nodeSelected = new EventEmitter<string>();

  private readonly registry = inject(DYNAMIC_COMPONENT_REGISTRY);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly applicationRef = inject(ApplicationRef);
  private readonly document = inject(DOCUMENT);
  private readonly appState = inject(AppStateService);
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly workflowRunner = inject(WorkflowRunnerService);
  private readonly dataEngineApi = inject(DataEngineApiService);
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private activeSession?: RenderSession;
  private renderVersion = 0;

  async ngOnChanges(): Promise<void> {
    const version = ++this.renderVersion;
    this.destroyActiveSession();

    const nodes = new Map(this.schema.components.map((node) => [node.id, node]));
    const session: RenderSession = {
      views: [],
      componentRefs: [],
      effects: [],
      nodesById: nodes,
      componentRefsById: new Map(),
      transientVariableNames: [],
    };
    const rootId = this.componentId ?? this.schema.rootComponentId;
    const root = nodes.get(rootId);
    if (!root) {
      console.warn(`[DynamicRenderer] No component with id "${rootId}" in schema "${this.schema.id}"`);
      return;
    }

    const renderedRoot = await this.renderNode(root, nodes, session, new Set());
    if (version !== this.renderVersion) {
      this.destroySession(session);
      return;
    }

    if (renderedRoot) {
      this.host.replaceChildren(renderedRoot);
      this.activeSession = session;
    } else {
      this.destroySession(session);
    }
  }

  ngOnDestroy(): void {
    this.renderVersion++;
    this.destroyActiveSession();
  }

  private async renderNode(
    node: DynamicComponentNode,
    nodes: Map<string, DynamicComponentNode>,
    session: RenderSession,
    ancestors: Set<string>,
  ): Promise<Node | null> {
    if (ancestors.has(node.id)) {
      console.warn(`[DynamicRenderer] Cyclic component hierarchy at "${node.id}"`);
      return null;
    }

    const path = new Set(ancestors);
    path.add(node.id);

    const type = node.type ?? (node.name ? 'component' : node.element ? 'element' : 'text');

    // Handled entirely separately — a `list` node's `children` are a
    // *template*, rendered once per fetched record (see `renderListNode`),
    // not once like every other node type's children below.
    if (type === 'list') {
      return this.renderListNode(node, nodes, session, path, ancestors.size === 0);
    }

    const children: Node[] = [];
    const childIds = [...(node.children ?? [])].sort((leftId, rightId) => {
      const left = nodes.get(leftId)?.position?.order;
      const right = nodes.get(rightId)?.position?.order;
      return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER);
    });
    for (const childId of childIds) {
      const child = nodes.get(childId);
      if (!child) {
        console.warn(`[DynamicRenderer] No component with id "${childId}" in schema "${this.schema.id}"`);
        continue;
      }
      const renderedChild = await this.renderNode(child, nodes, session, path);
      if (renderedChild) {
        children.push(renderedChild);
      }
    }

    if (type === 'text') {
      return this.document.createTextNode(node.text ?? '');
    }

    if (type === 'element') {
      const tagName = node.element?.toLowerCase();
      if (
        !tagName ||
        !/^[a-z][a-z0-9-]*$/i.test(tagName) ||
        ['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'style'].includes(tagName)
      ) {
        console.warn(`[DynamicRenderer] Invalid HTML element "${node.element ?? ''}"`);
        return null;
      }

      const element = this.document.createElement(tagName);
      this.applyElementAttributes(session, element, node.attributes);
      this.prepareNodeElement(element, node, ancestors.size === 0, ancestors.size === 1);
      if (ancestors.size === 0) {
        this.prepareApplicationRoot(element);
      }
      this.bindEvents(session, element, node);
      element.append(...children);
      return element;
    }

    if (!node.name) {
      console.warn(`[DynamicRenderer] Component node "${node.id}" has no name`);
      return null;
    }

    const loader = this.registry[node.name];
    if (!loader) {
      console.warn(`[DynamicRenderer] No registered component for name "${node.name}"`);
      return null;
    }

    const componentType: Type<unknown> = await loader();
    const hostElement = this.document.createElement('div');
    this.prepareNodeElement(hostElement, node, ancestors.size === 0, ancestors.size === 1);
    if (ancestors.size === 0) {
      this.prepareApplicationRoot(hostElement);
    }
    const componentRef = this.createComponent(componentType, hostElement, children);
    session.componentRefs.push(componentRef);
    session.views.push(componentRef.hostView);
    session.componentRefsById.set(node.id, componentRef);
    this.bindEvents(session, hostElement, node);

    for (const [key, value] of Object.entries(node.attributes ?? {})) {
      if (key === 'componentId') continue;
      this.bindReactiveValue(session, value, (resolved) => {
        if (key === 'style' && resolved && typeof resolved === 'object') {
          this.applyStyle(hostElement, resolved as Record<string, unknown>);
        } else if (key === 'class' && typeof resolved === 'string') {
          hostElement.className = resolved;
        } else {
          componentRef.setInput(key, resolved);
          // Every component gets `properties.styles` applied to its host
          // element here, generically — not every UI-library component
          // reads it itself (only a few do, e.g. `ElvButtonComponent`'s
          // own `[ngStyle]`), so this is what makes the pro-code editor's
          // "styles" property actually take effect on any component, not
          // just the ones that happened to opt in.
          if (key === 'properties' && resolved && typeof resolved === 'object') {
            const styles = (resolved as Record<string, unknown>)['styles'];
            if (styles && typeof styles === 'object') {
              this.applyStyle(hostElement, styles as Record<string, unknown>);
            }
          }
        }
        componentRef.changeDetectorRef.detectChanges();
      });
    }
    componentRef.setInput('componentId', node.id);
    componentRef.changeDetectorRef.detectChanges();

    return hostElement;
  }

  /**
   * "Eine Liste von Datensätzen, einmal pro Treffer gerendert" — fetches
   * `attributes.dataSource.entity` from `data-engine` (optionally filtered;
   * filter values may be `$variable` references, resolved like any other
   * attribute) and renders this node's `children` once per record, each
   * time with `attributes.itemAlias` (default `"item"`) bound to that
   * record's fields as `$alias.fieldName`.
   *
   * Not reactive to the underlying data changing elsewhere — fetched once
   * per render pass, same as every other external read in this renderer
   * (an http-request action's result isn't live either). Node ids are
   * reused verbatim across item instances (so clicking a rendered item in
   * the pro-code canvas still resolves back to the one real template node
   * for editing) — the consequence is that `control-component`/
   * `trigger-event` targeting a node inside a list only ever reaches the
   * *last* rendered item, a known limitation for this first version.
   */
  private async renderListNode(
    node: DynamicComponentNode,
    nodes: Map<string, DynamicComponentNode>,
    session: RenderSession,
    path: Set<string>,
    isApplicationRoot: boolean,
  ): Promise<Node | null> {
    const dataSource = listDataSourceOf(node);
    if (!dataSource?.entity) {
      console.warn(`[DynamicRenderer] list node "${node.id}" has no attributes.dataSource.entity`);
      return null;
    }
    const itemAlias = listItemAliasOf(node);

    const container = this.document.createElement('div');
    this.prepareNodeElement(container, node, isApplicationRoot, path.size === 2);
    if (isApplicationRoot) {
      this.prepareApplicationRoot(container);
    }
    this.applyStyle(container, (node.attributes?.['style'] as Record<string, unknown>) ?? {});
    if (typeof node.attributes?.['class'] === 'string') {
      container.className = node.attributes['class'] as string;
    }

    let records: Record<string, unknown>[] = [];
    try {
      const resolvedFilter = dataSource.filter ? (this.resolveVariables(dataSource.filter) as Record<string, unknown>) : undefined;
      const stringFilter = resolvedFilter
        ? Object.fromEntries(Object.entries(resolvedFilter).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
        : undefined;
      records = await firstValueFrom(this.dataEngineApi.listRecords(dataSource.entity, stringFilter));
    } catch (error) {
      console.warn(`[DynamicRenderer] list node "${node.id}" could not load "${dataSource.entity}":`, error);
      return container;
    }

    const templateIds = [...(node.children ?? [])].sort((leftId, rightId) => {
      const left = nodes.get(leftId)?.position?.order;
      const right = nodes.get(rightId)?.position?.order;
      return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER);
    });

    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const mangledAlias = `__list_${node.id}_${index}`;
      this.setTransientVariable(session, mangledAlias, record);
      for (const [fieldName, fieldValue] of Object.entries(record)) {
        this.setTransientVariable(session, `${mangledAlias}.${fieldName}`, fieldValue);
      }

      const itemNodes = new Map(nodes);
      for (const templateId of collectSubtreeIds(templateIds, nodes)) {
        const original = nodes.get(templateId);
        if (!original) continue;
        itemNodes.set(templateId, {
          ...original,
          attributes: original.attributes ? (rewriteAliasReferences(original.attributes, itemAlias, mangledAlias) as Record<string, unknown>) : original.attributes,
          text: original.text !== undefined ? (rewriteAliasReferences(original.text, itemAlias, mangledAlias) as string) : original.text,
        });
      }

      const itemWrapper = this.document.createElement('div');
      itemWrapper.dataset['elvListItem'] = String(index);
      for (const templateId of templateIds) {
        const renderedNode = await this.renderNode(itemNodes.get(templateId)!, itemNodes, session, path);
        if (renderedNode) itemWrapper.appendChild(renderedNode);
      }
      container.appendChild(itemWrapper);
    }

    return container;
  }

  /** Registers an ad-hoc global variable for the duration of this render pass only — `destroySession` removes everything tracked here, so repeated schema edits don't leak a growing pile of per-item variables. */
  private setTransientVariable(session: RenderSession, name: string, value: unknown): void {
    this.appState.setVariable(name, typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'json', value);
    session.transientVariableNames.push(name);
  }

  private prepareApplicationRoot(element: HTMLElement): void {
    element.style.position = 'relative';
    element.style.width = '100%';
    element.style.minHeight = '100%';

    const indicator = this.createDropIndicator();
    let dragDepth = 0;

    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-elyvion-node')
          ? 'move'
          : 'copy';
      }
      const bounds = element.getBoundingClientRect();
      this.positionDropIndicator(indicator, event.clientX - bounds.left, event.clientY - bounds.top);
    });
    element.addEventListener('dragenter', (event) => {
      event.preventDefault();
      dragDepth++;
      element.appendChild(indicator);
    });
    element.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        indicator.remove();
      }
    });
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      dragDepth = 0;
      indicator.remove();
      const transfer = event.dataTransfer;
      if (!transfer) {
        return;
      }

      const bounds = element.getBoundingClientRect();
      const nodeId = transfer.getData('application/x-elyvion-node') || undefined;
      const componentName = transfer.getData('application/x-elyvion-component') || undefined;
      if (!nodeId && !componentName) {
        return;
      }
      this.nodeDropped.emit({
        x: Math.max(0, Math.round(event.clientX - bounds.left)),
        y: Math.max(0, Math.round(event.clientY - bounds.top)),
        nodeId,
        componentName,
        insertBeforeNodeId: this.findInsertionSibling(element, event.clientY, nodeId),
      });
    });
    element.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof Element) {
        const node = target.closest<HTMLElement>('[data-elv-node-id]');
        if (node?.dataset['elvNodeId']) {
          this.nodeSelected.emit(node.dataset['elvNodeId']);
        }
      }
    });
  }

  /**
   * Finds which direct child of `root` the pointer (at `clientY`) is
   * above, so a flow-positioned drop can insert/move the node right
   * before it instead of just appending it at the end. Compares against
   * each sibling's vertical midpoint; `excludeNodeId` skips the node
   * being dragged itself, when repositioning an existing one.
   */
  private findInsertionSibling(root: HTMLElement, clientY: number, excludeNodeId?: string): string | undefined {
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const id = child.dataset['elvNodeId'];
      if (!id || id === excludeNodeId) continue;
      const rect = child.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * A small crosshair that follows the pointer while dragging a palette
   * item or an existing node over the canvas, so it's obvious exactly
   * where a drop will place it. Plain inline styles, not Tailwind classes
   * — this element is created imperatively at runtime, so it would never
   * be picked up by Tailwind's build-time class scanner. The color still
   * comes from the single `--color-elv-drop-indicator` design token (see
   * the client app's styles.css `@theme`), so it stays in sync with
   * anything else that references the same token.
   */
  private createDropIndicator(): HTMLElement {
    const indicator = this.document.createElement('div');
    indicator.setAttribute('data-elv-drop-indicator', '');
    Object.assign(indicator.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      marginLeft: '-6px',
      marginTop: '-6px',
      borderRadius: '9999px',
      border: '2px solid var(--color-elv-drop-indicator, #3b82f6)',
      backgroundColor: 'color-mix(in srgb, var(--color-elv-drop-indicator, #3b82f6) 25%, transparent)',
      pointerEvents: 'none',
      zIndex: '9999',
    } satisfies Partial<CSSStyleDeclaration>);

    const crosshair = (axis: 'x' | 'y') => {
      const line = this.document.createElement('div');
      Object.assign(line.style, {
        position: 'absolute',
        backgroundColor: 'var(--color-elv-drop-indicator, #3b82f6)',
        ...(axis === 'x'
          ? { left: '-2000px', top: '5px', width: '4000px', height: '2px' }
          : { top: '-2000px', left: '5px', height: '4000px', width: '2px' }),
      } satisfies Partial<CSSStyleDeclaration>);
      return line;
    };
    indicator.append(crosshair('x'), crosshair('y'));
    return indicator;
  }

  private positionDropIndicator(indicator: HTMLElement, x: number, y: number): void {
    indicator.style.left = `${Math.round(x)}px`;
    indicator.style.top = `${Math.round(y)}px`;
  }

  /** Attaches a native listener per `node.events` key — works for both plain elements and component hosts, since the handler listens on the DOM, not on a specific component's own `@Output()`. */
  private bindEvents(session: RenderSession, element: HTMLElement, node: DynamicComponentNode): void {
    for (const [eventName, actions] of Object.entries(node.events ?? {})) {
      element.addEventListener(eventName, (domEvent) => {
        domEvent.stopPropagation();
        this.runActions(session, actions, node);
      });
    }
  }

  private runActions(session: RenderSession, actions: EventAction[], sourceNode: DynamicComponentNode): void {
    for (const action of actions) {
      this.runAction(session, action, sourceNode);
    }
  }

  private runAction(session: RenderSession, action: EventAction, sourceNode: DynamicComponentNode): void {
    switch (action.type) {
      case 'set-variable': {
        if (!action.variableName) return;
        const existing = this.appState.getVariable(action.variableName);
        this.appState.setVariable(action.variableName, existing?.type ?? 'string', action.variableValue);
        return;
      }
      case 'trigger-event': {
        const targetNode = action.targetNodeId ? session.nodesById.get(action.targetNodeId) : sourceNode;
        const eventName = action.targetEvent ?? 'click';
        const targetActions = targetNode?.events?.[eventName];
        if (targetNode && targetActions) {
          this.runActions(session, targetActions, targetNode);
        } else {
          console.warn(`[DynamicRenderer] trigger-event: no "${eventName}" handler on node "${action.targetNodeId ?? sourceNode.id}"`);
        }
        return;
      }
      case 'control-component': {
        if (!action.targetComponentId || !action.functionName) return;
        const target = session.componentRefsById.get(action.targetComponentId);
        const instance = target?.instance as Record<string, unknown> | undefined;
        const fn = instance?.[action.functionName];
        if (typeof fn === 'function') {
          (fn as (...args: unknown[]) => unknown).apply(instance, action.functionArgs ?? []);
          target?.changeDetectorRef.detectChanges();
        } else {
          console.warn(`[DynamicRenderer] control-component: "${action.targetComponentId}" has no method "${action.functionName}"`);
        }
        return;
      }
      case 'run-script': {
        if (!action.script) return;
        try {
          // Trusted-builder-authored code only — see EventAction's doc comment.
          new Function('appState', 'sourceNode', action.script)(this.appState, sourceNode);
        } catch (error) {
          console.error('[DynamicRenderer] run-script failed:', error);
        }
        return;
      }
      case 'call-service':
        console.warn('[DynamicRenderer] call-service is not implemented yet — no service registry to target.');
        return;
      case 'run-workflow': {
        if (!action.workflowKey) return;
        const key = action.workflowKey;
        this.workflowApi.get(key).subscribe({
          next: (record) => {
            if (record.target === 'frontend') {
              this.workflowRunner.run(this.workflowApi.toDefinition(record)).then((result) => {
                if (result.status === 'failed') {
                  console.error(`[DynamicRenderer] workflow "${key}" failed:`, result.error);
                }
              });
            } else {
              // Backend-target — the workflow-engine module executes it itself.
              this.workflowApi.run(key).subscribe({
                error: (error: unknown) => console.error(`[DynamicRenderer] workflow "${key}" failed:`, error),
              });
            }
          },
          error: (error: unknown) => console.error(`[DynamicRenderer] no workflow "${key}":`, error),
        });
        return;
      }
    }
  }

  private prepareNodeElement(
    element: HTMLElement,
    node: DynamicComponentNode,
    isApplicationRoot: boolean,
    isDirectChild: boolean,
  ): void {
    element.dataset['elvNodeId'] = node.id;
    if (!isApplicationRoot && isDirectChild) {
      element.draggable = true;
      element.style.cursor = 'move';
      element.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('application/x-elyvion-node', node.id);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
        }
      });
    }
    if (node.position && isAbsolutelyPositioned(node)) {
      element.style.position = 'absolute';
      element.style.left = `${node.position.x}px`;
      element.style.top = `${node.position.y}px`;
      element.style.zIndex = String(node.position.zIndex ?? node.position.order ?? 1);
    }
  }

  private createComponent(
    componentType: Type<unknown>,
    hostElement: HTMLElement,
    projectableNodes: Node[],
  ): ComponentRef<unknown> {
    const componentRef = createComponent(componentType, {
      environmentInjector: this.environmentInjector,
      hostElement,
      projectableNodes: [projectableNodes],
    });
    this.applicationRef.attachView(componentRef.hostView);
    return componentRef;
  }

  private applyElementAttributes(
    session: RenderSession,
    element: HTMLElement,
    attributes?: Record<string, unknown>,
  ): void {
    if (!attributes) {
      return;
    }

    for (const [name, rawValue] of Object.entries(attributes)) {
      const normalizedName = name.toLowerCase();
      if (!/^[a-z_:][a-z0-9_.:-]*$/i.test(name) || normalizedName.startsWith('on') || normalizedName === 'srcdoc') {
        continue;
      }

      this.bindReactiveValue(session, rawValue, (value) => {
        if (value == null) return;

        if (name === 'style' && typeof value === 'object') {
          this.applyStyle(element, value as Record<string, unknown>);
          return;
        }

        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return;
        }

        const text = String(value);
        if (
          ['href', 'src', 'action', 'formaction', 'xlink:href'].includes(normalizedName) &&
          /^\s*javascript:/i.test(text)
        ) {
          return;
        }

        if (
          typeof value === 'boolean' &&
          ['allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
            'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple',
            'muted', 'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed',
            'selected'].includes(normalizedName)
        ) {
          if (value) {
            element.setAttribute(name, '');
          } else {
            element.removeAttribute(name);
          }
        } else {
          element.setAttribute(name, text);
        }
      });
    }
  }

  private applyStyle(element: HTMLElement, value: Record<string, unknown>): void {
    for (const [property, propertyValue] of Object.entries(value)) {
      if (typeof propertyValue === 'string' || typeof propertyValue === 'number') {
        element.style.setProperty(property, String(propertyValue));
      }
    }
  }

  /**
   * Applies `rawValue` once if it (and everything nested inside it)
   * contains no `$variableName` reference. Otherwise applies the
   * resolved value immediately and keeps it current with an `effect()`
   * that re-resolves and re-applies whenever any referenced variable
   * changes — e.g. `attributes.style.color: "$accentColor"` updates
   * every element using it the moment that variable's value changes,
   * with no full re-render of the tree.
   */
  private bindReactiveValue(session: RenderSession, rawValue: unknown, apply: (value: unknown) => void): void {
    if (!this.hasVariableReference(rawValue)) {
      apply(rawValue);
      return;
    }

    const effectRef = effect(() => apply(this.resolveVariables(rawValue)), {
      injector: this.environmentInjector,
    });
    session.effects.push(effectRef);
  }

  private hasVariableReference(value: unknown): boolean {
    if (parseVariableReference(value)) return true;
    if (Array.isArray(value)) return value.some((item) => this.hasVariableReference(item));
    if (value && typeof value === 'object') {
      return Object.values(value).some((item) => this.hasVariableReference(item));
    }
    return false;
  }

  /** Reads through `AppStateService`'s signals, so calling this inside an `effect()` tracks the referenced variables as dependencies. */
  private resolveVariables(value: unknown): unknown {
    const ref = parseVariableReference(value);
    if (ref) {
      return this.appState.variableSignal(ref)();
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveVariables(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.resolveVariables(item)]),
      );
    }
    return value;
  }

  private destroyActiveSession(): void {
    if (this.activeSession) {
      this.destroySession(this.activeSession);
      this.activeSession = undefined;
    }
    this.host.replaceChildren();
  }

  private destroySession(session: RenderSession): void {
    for (const effectRef of session.effects) {
      effectRef.destroy();
    }
    for (const view of session.views) {
      this.applicationRef.detachView(view);
    }
    for (const componentRef of session.componentRefs) {
      componentRef.destroy();
    }
    for (const name of session.transientVariableNames) {
      this.appState.removeVariable(name);
    }
  }
}

/** Every node id reachable from `rootIds` via `children` — the whole template subtree a `list` node clones once per record. */
function collectSubtreeIds(rootIds: string[], nodes: Map<string, DynamicComponentNode>): string[] {
  const seen = new Set<string>();
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.get(id);
    if (node?.children) stack.push(...node.children);
  }
  return [...seen];
}

/**
 * Replaces a `"$alias"` or `"$alias.field"` string (and the same inside
 * nested arrays/objects) with `"$mangledAlias"`/`"$mangledAlias.field"` —
 * everything else is left untouched. Used to make a `list` node's item
 * template's `$itemAlias.*` references point at the per-instance variables
 * `renderListNode` sets up for one specific record.
 */
function rewriteAliasReferences(value: unknown, alias: string, mangledAlias: string): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const ref = value.slice(1);
    if (ref === alias) return `$${mangledAlias}`;
    if (ref.startsWith(`${alias}.`)) return `$${mangledAlias}${ref.slice(alias.length)}`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAliasReferences(item, alias, mangledAlias));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteAliasReferences(item, alias, mangledAlias)]));
  }
  return value;
}
