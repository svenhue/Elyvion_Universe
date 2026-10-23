import {
  Component,
  ComponentRef,
  Input,
  OnChanges,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { DYNAMIC_COMPONENT_REGISTRY } from '../registry/dynamic-component-registry';
import { DynamicAppSchema } from '../schema/dynamic-app-schema';

/**
 * Renders one schema node (and recursively its children) by resolving
 * `node.name` against the host app's component registry, lazily loading
 * that component's code, and applying `attributes` (style + inputs).
 *
 * Usage: <elv-dynamic-renderer [schema]="appSchema" />
 * (componentId defaults to schema.rootComponentId)
 */
@Component({
  selector: 'elv-dynamic-renderer',
  standalone: true,
  template: `<ng-container #anchor></ng-container>`,
})
export class DynamicRendererComponent implements OnChanges {
  @Input({ required: true }) schema!: DynamicAppSchema;
  @Input() componentId?: string;

  @ViewChild('anchor', { read: ViewContainerRef, static: true })
  private anchor!: ViewContainerRef;

  private readonly registry = inject(DYNAMIC_COMPONENT_REGISTRY);

  async ngOnChanges(): Promise<void> {
    this.anchor.clear();

    const nodeId = this.componentId ?? this.schema.rootComponentId;
    const node = this.schema.components.find((c) => c.id === nodeId);
    if (!node) {
      console.warn(`[DynamicRenderer] No component with id "${nodeId}" in schema "${this.schema.id}"`);
      return;
    }

    const loader = this.registry[node.name];
    if (!loader) {
      console.warn(`[DynamicRenderer] No registered component for name "${node.name}"`);
      return;
    }

    const componentType = await loader();
    const componentRef = this.anchor.createComponent(componentType);
    this.applyAttributes(componentRef, node.attributes);

    for (const childId of node.children ?? []) {
      const childRef = this.anchor.createComponent(DynamicRendererComponent);
      childRef.setInput('schema', this.schema);
      childRef.setInput('componentId', childId);
    }
  }

  private applyAttributes(
    componentRef: ComponentRef<unknown>,
    attributes?: Record<string, unknown>,
  ): void {
    if (!attributes) return;

    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'style' && value && typeof value === 'object') {
        const hostElement = componentRef.location.nativeElement as HTMLElement;
        for (const [property, propertyValue] of Object.entries(value as Record<string, string>)) {
          hostElement.style.setProperty(property, propertyValue);
        }
      } else {
        componentRef.setInput(key, value);
      }
    }
  }
}
