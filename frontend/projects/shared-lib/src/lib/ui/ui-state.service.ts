import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ElvUiState<T = unknown> {
  key: string;
  value: T;
}

export interface ElvUiStateChange {
  componentId: string;
  state: ElvUiState;
}

@Injectable({ providedIn: 'root' })
export class ElvUiStateService {
  private readonly stateChanges = new Subject<ElvUiStateChange>();
  private readonly componentStates = new Map<
    string,
    { changes: Subject<ElvUiState>; values: Map<string, ElvUiState> }
  >();

  readonly stateChanges$: Observable<ElvUiStateChange> = this.stateChanges.asObservable();

  stateChangesFor(componentId: string): Observable<ElvUiState> {
    return new Observable((subscriber) => {
      const componentState = this.getComponentState(componentId);
      for (const state of componentState.values.values()) {
        subscriber.next(state);
      }
      return componentState.changes.subscribe(subscriber);
    });
  }

  setState(componentId: string, state: ElvUiState): void {
    if (!componentId.trim()) {
      throw new Error('A componentId is required to update UI component state.');
    }

    if (!state || typeof state.key !== 'string' || !state.key.trim()) {
      throw new Error('UI state must include a non-empty key and a value.');
    }

    const componentState = this.getComponentState(componentId);
    componentState.values.set(state.key, state);
    componentState.changes.next(state);
    this.stateChanges.next({ componentId, state });
  }

  private getComponentState(
    componentId: string,
  ): { changes: Subject<ElvUiState>; values: Map<string, ElvUiState> } {
    let state = this.componentStates.get(componentId);
    if (!state) {
      state = { changes: new Subject<ElvUiState>(), values: new Map() };
      this.componentStates.set(componentId, state);
    }
    return state;
  }
}
