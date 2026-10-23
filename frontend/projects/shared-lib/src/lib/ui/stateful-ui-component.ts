import { Directive, DestroyRef, HostBinding, inject, Input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ElvUiState, ElvUiStateService } from './ui-state.service';

@Directive()
export abstract class ElvStatefulUiComponent implements OnInit {
  @Input() componentId = '';

  @HostBinding('class') stateClass = '';

  private readonly stateValues = new Map<string, unknown>();

  private readonly stateService = inject(ElvUiStateService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    if (!this.componentId) {
      return;
    }

    this.stateService
      .stateChangesFor(this.componentId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => {
        this.stateValues.set(state.key, state.value);
        if (state.key === 'class') {
          this.stateClass = typeof state.value === 'string' ? state.value : '';
        }
      });
  }

  protected stateValue(key: string): unknown {
    return this.stateValues.get(key);
  }

  protected updateState<T>(key: string, value: T): void {
    const state: ElvUiState<T> = { key, value };
    this.stateValues.set(key, value);
    if (this.componentId) {
      this.stateService.setState(this.componentId, state);
    }
  }
}
