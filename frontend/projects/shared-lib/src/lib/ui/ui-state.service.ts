import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

export interface ElvUiStateChange<T = unknown> {
  componentId: string;
  key: string;
  value: T;
}

/**
 * Per-component, per-key UI state (e.g. a text input's live typed value, a
 * toggle's checked state) — distinct from a component's `properties`
 * input, which is the builder-authored, mostly-static configuration. Any
 * component extending `ElvStatefulUiComponent` can be read from or written
 * to here by its `componentId`, e.g. from a pro-code event-handler action.
 *
 * Signals-based: a read via `stateSignal()` is a normal Angular signal,
 * so templates/`computed()`/effects re-run automatically on change — no
 * manual subscription or unsubscription needed by consumers. Each
 * component's slot is explicitly freed via `removeComponent()` when that
 * component is destroyed (see `ElvStatefulUiComponent.ngOnDestroy`); with
 * free-form, builder-generated `componentId`s that come and go constantly,
 * never cleaning these up would leak one Map entry per element ever
 * created for the life of the app.
 */
@Injectable({ providedIn: 'root' })
export class ElvUiStateService {
  private readonly componentStates = new Map<string, Map<string, WritableSignal<unknown>>>();
  private readonly lastChangeSignal = signal<ElvUiStateChange | null>(null);

  /** Observability hook — e.g. for a future devtools/inspector panel. */
  readonly lastChange: Signal<ElvUiStateChange | null> = this.lastChangeSignal.asReadonly();

  /** Read-only signal for one component's one state key (created lazily, starts `undefined`). */
  stateSignal<T = unknown>(componentId: string, key: string): Signal<T | undefined> {
    return this.writableStateSignal<T>(componentId, key).asReadonly();
  }

  setState<T>(componentId: string, key: string, value: T): void {
    if (!componentId.trim()) {
      throw new Error('A componentId is required to update UI component state.');
    }
    if (!key.trim()) {
      throw new Error('UI state must include a non-empty key.');
    }

    this.writableStateSignal<T>(componentId, key).set(value);
    this.lastChangeSignal.set({ componentId, key, value });
  }

  /** Frees a component's entire state slot. Call when that component instance is destroyed. */
  removeComponent(componentId: string): void {
    this.componentStates.delete(componentId);
  }

  private writableStateSignal<T>(componentId: string, key: string): WritableSignal<T | undefined> {
    let keys = this.componentStates.get(componentId);
    if (!keys) {
      keys = new Map();
      this.componentStates.set(componentId, keys);
    }

    let state = keys.get(key) as WritableSignal<T | undefined> | undefined;
    if (!state) {
      state = signal<T | undefined>(undefined);
      keys.set(key, state);
    }
    return state;
  }
}
