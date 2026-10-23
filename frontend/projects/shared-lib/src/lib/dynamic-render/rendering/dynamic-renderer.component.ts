import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Type,
  ViewRef,
} from '@angular/core';
import { DYNAMIC_COMPONENT_REGISTRY } from '../registry/dynamic-component-registry';
import { DynamicAppSchema, DynamicComponentNode } from '../schema/dynamic-app-schema';

interface RenderSession {
  views: ViewRef[];
  componentRefs: ComponentRef<unknown>[];
}

/**
 * Renders component, native-element and text nodes from a DynamicAppSchema.
 */
@Component({
  selector: 'elv-dynamic-renderer',
  standalone: true,
  template: '',
})
export class DynamicRendererComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) schema!: DynamicAppSchema;
  @Input() componentId?: string;

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
    for (const childId of node.children ?? []) {
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
