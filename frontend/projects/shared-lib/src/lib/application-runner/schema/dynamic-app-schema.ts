import { EventHandlers } from './event-action';

/**
 * Runtime representation of the JSON meta-schema in
 * `dynamic-app.schema.json`. A DynamicAppSchema describes a UI as data:
 * which Angular components, native elements, and text nodes exist, how they
 * nest, and which attributes or inputs each instance gets.
 */
export interface DynamicComponentNode {
  /** Unique id of this component instance within the schema. */
  id: string;
  /**
   * Defaults to `component` when `name` is provided. `list` must be set
   * explicitly (it has neither `name`, `element`, nor `text`, so it would
   * otherwise fall through to `text`) — see `ListDataSource` and
   * `DynamicRendererComponent`'s `renderListNode`.
   */
  type?: 'component' | 'element' | 'text' | 'list';
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
   * `x`/`y`/`zIndex` only take effect when this node opts into absolute
   * placement (`style.position` / `properties.styles.position` is
   * `"absolute"` or `"fixed"`, see {@link isAbsolutelyPositioned}).
   * Otherwise the node renders in normal document flow and only `order`
   * is used, to sort it among its siblings.
   */
  position?: {
    x: number;
    y: number;
    zIndex?: number;
    order?: number;
  };
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
  /** DOM-ish event name (e.g. "click") → actions run in order when it fires on this node. */
  events?: EventHandlers;
}

/**
 * A `type: 'list'` node's own configuration — stored under
 * `attributes.dataSource`/`attributes.itemAlias` (no schema change needed
 * on the `app-config` backend, `attributes` is already an open record).
 * `filter` values may themselves be `"$variableName"` references, resolved
 * the same way any other attribute is — so a list can be scoped to e.g.
 * "issues in the currently selected project" rather than always showing
 * every record of `entity`.
 */
export interface ListDataSource {
  entity: string;
  filter?: Record<string, unknown>;
}

export function listDataSourceOf(node: DynamicComponentNode): ListDataSource | undefined {
  return node.attributes?.['dataSource'] as ListDataSource | undefined;
}

export function listItemAliasOf(node: DynamicComponentNode): string {
  return (node.attributes?.['itemAlias'] as string | undefined)?.trim() || 'item';
}

export interface DynamicAppSchema {
  /** Matches the applicationId a DynamicAppService consumer requests. */
  id: string;
  name: string;
  version: string;
  /** Id of the node to start rendering from. */
  rootComponentId: string;
  components: DynamicComponentNode[];
  /** When on, saving this schema in pro-code also mirrors it into its own `"angular_app_config"` ontology — see `AppOntologySyncService`. Off by default. */
  ontologySyncEnabled?: boolean;
}

/**
 * Whether `node` has explicitly opted into absolute/fixed placement via its
 * style properties. Everything else renders in normal flow by default —
 * see {@link DynamicComponentNode.position}.
 */
export function isAbsolutelyPositioned(node: DynamicComponentNode): boolean {
  const attributes = node.attributes;
  if (!attributes) return false;
  const elementStyle = attributes['style'];
  const properties = attributes['properties'];
  const componentStyles =
    properties && typeof properties === 'object' && !Array.isArray(properties)
      ? (properties as Record<string, unknown>)['styles']
      : undefined;
  const styleSource =
    elementStyle && typeof elementStyle === 'object'
      ? elementStyle
      : componentStyles && typeof componentStyles === 'object'
        ? componentStyles
        : undefined;
  const position = (styleSource as Record<string, unknown> | undefined)?.['position'];
  return position === 'absolute' || position === 'fixed';
}
