import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  EventEmitter,
  EnvironmentInjector,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Type,
  ViewRef,
} from '@angular/core';
import { DYNAMIC_COMPONENT_REGISTRY } from '../registry/dynamic-component-registry';
import { DynamicAppSchema, DynamicComponentNode } from '../schema/dynamic-app-schema';

interface RenderSession {
  views: ViewRef[];
  componentRefs: ComponentRef<unknown>[];
}

export interface DynamicElementDrop {
  x: number;
  y: number;
  nodeId?: string;
  componentName?: string;
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
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private activeSession?: RenderSession;
  private renderVersion = 0;

  async ngOnChanges(): Promise<void> {
    const version = ++this.renderVersion;
    this.destroyActiveSession();

    const session: RenderSession = { views: [], componentRefs: [] };
    const nodes = new Map(this.schema.components.map((node) => [node.id, node]));
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

    const type = node.type ?? (node.name ? 'component' : node.element ? 'element' : 'text');
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
      this.applyElementAttributes(element, node.attributes);
      this.prepareNodeElement(element, node, ancestors.size === 0, ancestors.size === 1);
      if (ancestors.size === 0) {
        this.prepareApplicationRoot(element);
      }
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

    for (const [key, value] of Object.entries(node.attributes ?? {})) {
      if (key === 'style' && value && typeof value === 'object') {
        this.applyStyle(hostElement, value);
      } else if (key === 'class' && typeof value === 'string') {
        hostElement.className = value;
      } else if (key !== 'componentId') {
        componentRef.setInput(key, value);
      }
    }
    componentRef.setInput('componentId', node.id);
    componentRef.changeDetectorRef.detectChanges();

    return hostElement;
  }

  private prepareApplicationRoot(element: HTMLElement): void {
    element.style.position = 'relative';
    element.style.width = '100%';
    element.style.minHeight = '100%';
    element.addEventListener('dragover', (event) => event.preventDefault());
    element.addEventListener('drop', (event) => {
      event.preventDefault();
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
    if (node.position) {
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

  private applyElementAttributes(element: HTMLElement, attributes?: Record<string, unknown>): void {
    if (!attributes) {
      return;
    }

    for (const [name, value] of Object.entries(attributes)) {
      const normalizedName = name.toLowerCase();
      if (
        !/^[a-z_:][a-z0-9_.:-]*$/i.test(name) ||
        normalizedName.startsWith('on') ||
        normalizedName === 'srcdoc' ||
        value == null
      ) {
        continue;
      }

      if (name === 'style' && typeof value === 'object') {
        this.applyStyle(element, value);
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value);
        if (
          ['href', 'src', 'action', 'formaction', 'xlink:href'].includes(normalizedName) &&
          /^\s*javascript:/i.test(text)
        ) {
          continue;
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
          }
        } else {
          element.setAttribute(name, text);
        }
      }
    }
  }

  private applyStyle(element: HTMLElement, value: object): void {
    for (const [property, propertyValue] of Object.entries(value)) {
      if (typeof propertyValue === 'string' || typeof propertyValue === 'number') {
        element.style.setProperty(property, String(propertyValue));
      }
    }
  }

  private destroyActiveSession(): void {
    if (this.activeSession) {
      this.destroySession(this.activeSession);
      this.activeSession = undefined;
    }
    this.host.replaceChildren();
  }

  private destroySession(session: RenderSession): void {
    for (const view of session.views) {
      this.applicationRef.detachView(view);
    }
    for (const componentRef of session.componentRefs) {
      componentRef.destroy();
    }
  }
}
