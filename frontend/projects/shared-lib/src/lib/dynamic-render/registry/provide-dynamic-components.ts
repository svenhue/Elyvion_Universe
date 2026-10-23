import { Provider } from '@angular/core';
import { DYNAMIC_COMPONENT_REGISTRY, DynamicComponentRegistry } from './dynamic-component-registry';

/**
 * Registers which component types a schema's `name` values may resolve
 * to. Call once in the host app's bootstrap config:
 *
 * provideDynamicComponents({
 *   'page-header': () => import('./components/page-header.component').then(m => m.PageHeaderComponent),
 *   'data-table': () => import('./components/data-table.component').then(m => m.DataTableComponent),
 * })
 */
export function provideDynamicComponents(registry: DynamicComponentRegistry): Provider {
  return { provide: DYNAMIC_COMPONENT_REGISTRY, useValue: registry };
}
