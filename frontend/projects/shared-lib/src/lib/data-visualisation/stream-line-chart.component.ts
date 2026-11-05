import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnChanges,
  Signal,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';
import { ElvStatefulUiComponent, ElvObservableState } from '../ui/stateful-ui-component';
import { ElvUiStateService } from '../ui/ui-state.service';
import { ElvChartSeries } from './data-viz.types';
import { ElvLineChartComponent } from './cartesian-chart.component';
import { ElvVizStateComponent } from './viz-state.component';

const INITIAL_STREAM_STATE: ElvObservableState<readonly ElvChartSeries[]> = {
  status: 'loading',
  value: [],
  hasData: false,
  stale: false,
  error: null,
};

@Component({
  selector: 'elv-ui-state-line-chart',
  standalone: true,
  imports: [ElvLineChartComponent, ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state().hasData) {
      <elv-line-chart
        [series]="state().value"
        [ariaLabel]="ariaLabel()"
        [status]="state().status"
        [stale]="state().stale"
      />
    } @else {
      <elv-viz-state [status]="state().status" [stale]="state().stale" />
    }
  `,
})
export class ElvUiStateLineChartComponent extends ElvStatefulUiComponent implements OnChanges {
  private readonly uiState = inject(ElvUiStateService);
  private readonly injector = inject(Injector);
  private readonly connectedState = signal<Signal<ElvObservableState<readonly ElvChartSeries[]>> | null>(null);

  readonly stateKey = input('series');
  readonly ariaLabel = input('Chart from shared UI state');
  readonly state = computed(() => this.connectedState()?.() ?? INITIAL_STREAM_STATE);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['componentId'] && !changes['stateKey']) return;
    if (!this.componentId.trim()) return;
    const source = toObservable(
      this.uiState.stateSignal<readonly ElvChartSeries[]>(this.componentId, this.stateKey()),
      { injector: this.injector },
    ).pipe(map((value) => value ?? []));
    this.connectedState.set(this.connect(source, {
      initialValue: [],
      mapToViewState: (series) => series,
      isEmpty: (series) => series.length === 0,
    }));
  }
}

@Component({
  selector: 'elv-observable-line-chart',
  standalone: true,
  imports: [ElvLineChartComponent, ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state().hasData) {
      <elv-line-chart
        [series]="state().value"
        [ariaLabel]="ariaLabel()"
        [status]="state().status"
        [stale]="state().stale"
      />
    } @else {
      <elv-viz-state [status]="state().status" [stale]="state().stale" />
    }
  `,
})
export class ElvObservableLineChartComponent extends ElvStatefulUiComponent implements OnChanges {
  private readonly connectedState = signal<Signal<ElvObservableState<readonly ElvChartSeries[]>> | null>(null);

  readonly source = input.required<Observable<readonly ElvChartSeries[]>>();
  readonly ariaLabel = input('Chart from observable stream');
  readonly state = computed(() => this.connectedState()?.() ?? INITIAL_STREAM_STATE);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['source']) return;
    this.connectedState.set(this.connect(this.source(), {
      initialValue: [],
      mapToViewState: (series) => series,
      isEmpty: (series) => series.length === 0,
    }));
  }
}
