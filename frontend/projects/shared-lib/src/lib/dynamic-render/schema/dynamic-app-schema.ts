/**
 * Runtime representation of the JSON meta-schema in
 * `dynamic-app.schema.json`. A DynamicAppSchema describes an Angular
 * application as data: which components exist, how they nest, and which
 * attributes (style + inputs) each instance gets — nothing here references
 * actual Angular component classes, so the schema can be produced and
 * stored independently of any specific frontend build.
 */
export interface DynamicComponentNode {
  /** Unique id of this component instance within the schema. */
  id: string;
  /**
   * Logical component type name. The host application's component
   * registry (see `provideDynamicComponents`) maps this name to the
   * actual (lazily loaded) Angular component class.
   */
  name: string;
  /**
   * Arbitrary attributes for this instance. By convention:
   * - `attributes.style` is a CSS-property-name → value map applied to the
   *   component's host element (e.g. `{ "background-color": "#fff" }`).
   * - every other key is passed to the component as an `@Input()` via
   *   `ComponentRef.setInput()`.
   */
  attributes?: Record<string, unknown>;
  /** Ids of this node's children, rendered in order inside the renderer's own container. */
  children?: string[];
}

export interface DynamicAppSchema {
  /** Matches the applicationId a DynamicAppService consumer requests. */
  id: string;
  name: string;
  version: string;
  /** Id of the component node to start rendering from. */
  rootComponentId: string;
  components: DynamicComponentNode[];
}
