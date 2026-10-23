import { Directive, HostBinding, Input, OnDestroy, inject } from '@angular/core';
import { ElvUiStateService } from './ui-state.service';

@Directive()
export abstract class ElvStatefulUiComponent implements OnDestroy {
  @Input() componentId = '';

  private readonly stateService = inject(ElvUiStateService);

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
}
