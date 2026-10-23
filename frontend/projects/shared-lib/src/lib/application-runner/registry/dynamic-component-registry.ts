import { InjectionToken, Type } from '@angular/core';

/**
 * A loader is a thunk returning a dynamic `import()` promise — the exact
 * shape Angular's own `loadComponent` route config uses. The bundler
 * code-splits each loader into its own chunk, so a component's code is
 * only downloaded the first time the renderer actually needs it (i.e. it
 * really is "loaded at runtime", not just instantiated from an eagerly
 * bundled class).
 */
export type DynamicComponentLoader = () => Promise<Type<unknown>>;

/** Maps a schema node's `name` to how to load the component it refers to. */
export type DynamicComponentRegistry = Record<string, DynamicComponentLoader>;

export const DYNAMIC_COMPONENT_REGISTRY = new InjectionToken<DynamicComponentRegistry>(
  'DYNAMIC_COMPONENT_REGISTRY',
);
