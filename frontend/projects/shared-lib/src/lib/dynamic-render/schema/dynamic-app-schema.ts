/**
 * Runtime representation of the JSON meta-schema in
 * `dynamic-app.schema.json`. A DynamicAppSchema describes a UI as data:
 * which Angular components, native elements, and text nodes exist, how they
 * nest, and which attributes or inputs each instance gets.
 */
export interface DynamicComponentNode {
  /** Unique id of this component instance within the schema. */
  id: string;
  /** Defaults to `component` when `name` is provided. */
  type?: 'component' | 'element' | 'text';
  /**
   * Logical component type name. The host application's component
   * registry (see `provideDynamicComponents`) maps this name to the
   * actual (lazily loaded) Angular component class.
   */
  name?: string;
  /** Native HTML tag, required when `type` is `element`. */
  element?: string;
  /** Text content, required when `type` is `text`. */
  text?: string;
  /**
   * Arbitrary attributes for this instance. By convention:
   * - `attributes.style` is a CSS-property-name → value map applied to the
   *   component's host element (e.g. `{ "background-color": "#fff" }`).
   * - every other key is passed to the component as an `@Input()` via
   *   `ComponentRef.setInput()`.
   */
  attributes?: Record<string, unknown>;
  /** Ids of this node's children, rendered in order inside its element or component host. */
  children?: string[];
}

export interface DynamicAppSchema {
  /** Matches the applicationId a DynamicAppService consumer requests. */
  id: string;
  name: string;
  version: string;
  /** Id of the node to start rendering from. */
  rootComponentId: string;
  components: DynamicComponentNode[];
}
