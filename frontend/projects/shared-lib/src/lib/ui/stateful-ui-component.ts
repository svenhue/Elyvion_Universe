import { Directive, DestroyRef, HostBinding, Input, OnDestroy, Signal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';
import { ElvUiStateService } from './ui-state.service';

export type ElvObservableStatus = 'loading' | 'data' | 'empty' | 'error' | 'closed';

export interface ElvObservableState<T> {
  status: ElvObservableStatus;
  value: T;
  hasData: boolean;
  stale: boolean;
  error: unknown | null;
}

export interface ElvObservableOptions<T, ViewModel = T> {
  initialValue: ViewModel;
  mapToViewState: (value: T) => ViewModel;
  isEmpty?: (value: T) => boolean;
}

@Directive()
export abstract class ElvStatefulUiComponent implements OnDestroy {
  @Input() componentId = '';

  private readonly stateService = inject(ElvUiStateService);
  private readonly destroyRef = inject(DestroyRef);
  private streamSubscription: Subscription | null = null;

  @HostBinding('class')
  protected get stateClass(): string {
    return this.componentId ? (this.stateService.stateSignal<string>(this.componentId, 'class')() ?? '') : '';
  }

  ngOnDestroy(): void {
    if (this.componentId) {
      this.stateService.removeComponent(this.componentId);
    }
  }

  protected stateValue<T = unknown>(key: string): T | undefined {
    return this.componentId ? this.stateService.stateSignal<T>(this.componentId, key)() : undefined;
  }

  protected updateState<T>(key: string, value: T): void {
    if (this.componentId) {
      this.stateService.setState(this.componentId, key, value);
    }
  }

  /**
   * Connects this component to one external stream. Connecting again replaces
   * the previous stream; the active subscription is always disposed on destroy.
   */
  protected connect<T, ViewModel = T>(
    source: Observable<T>,
    options: ElvObservableOptions<T, ViewModel>,
  ): Signal<ElvObservableState<ViewModel>> {
    this.streamSubscription?.unsubscribe();

    const state = signal<ElvObservableState<ViewModel>>({
      status: 'loading',
      value: options.initialValue,
      hasData: false,
      stale: false,
      error: null,
    });

    this.streamSubscription = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        const previous = state();
        try {
          const viewValue = options.mapToViewState(value);
          const empty = options.isEmpty?.(value) ?? isEmptyValue(value);
          state.set({
            status: empty ? 'empty' : 'data',
            value: viewValue,
            hasData: true,
            stale: false,
            error: null,
          });
        } catch (error) {
          state.set({
            ...previous,
            status: 'error',
            stale: previous.hasData,
            error,
          });
        }
      },
      error: (error: unknown) => {
        const previous = state();
        state.set({
          ...previous,
          status: 'error',
          stale: previous.hasData,
          error,
        });
      },
      complete: () => {
        const previous = state();
        state.set({
          ...previous,
          status: 'closed',
          stale: previous.hasData,
        });
      },
    });

    return state.asReadonly();
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value == null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  return false;
}
