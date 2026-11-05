import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ElvStatefulUiComponent } from '../ui/stateful-ui-component';
import {
  ElvDonutSlice,
  ElvHeatmapCell,
  ElvHeatmapCellViewModel,
  ElvVizStatus,
} from './data-viz.types';
import { ElvVizStateComponent } from './viz-state.component';

const DONUT_COLOR_TOKENS = [
  '--color-blue-600',
  '--color-emerald-600',
  '--color-violet-600',
  '--color-amber-600',
  '--color-rose-600',
  '--color-cyan-600',
];

@Component({
  selector: 'elv-donut-chart',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'data') {
      <elv-viz-state [status]="status()" [stale]="stale()" />
    }
    @if (viewModel().length) {
      <figure class="elv-donut">
        <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="summary()">
          <circle class="elv-donut__track" cx="60" cy="60" r="44" />
          @for (slice of viewModel(); track slice.label; let index = $index) {
            <circle
              class="elv-donut__slice"
              cx="60"
              cy="60"
              r="44"
              [attr.stroke]="slice.color ?? seriesColor(index)"
              [attr.stroke-dasharray]="slice.dashArray"
              [attr.stroke-dashoffset]="slice.dashOffset"
              [attr.transform]="'rotate(-90 60 60)'"
            >
              <title>{{ slice.label }}: {{ slice.value }} ({{ slice.percentage }}%)</title>
            </circle>
          }
          <text x="60" y="58" text-anchor="middle" class="elv-donut__total">{{ total() }}</text>
          <text x="60" y="72" text-anchor="middle" class="elv-donut__caption">{{ totalLabel() }}</text>
        </svg>
        <ul aria-label="Chart legend">
          @for (slice of viewModel(); track slice.label; let index = $index) {
            <li>
              <span class="elv-donut__swatch" [style.background-color]="slice.color ?? seriesColor(index)"></span>
              <span>{{ slice.label }}</span>
              <span>{{ slice.value }} ({{ slice.percentage }}%)</span>
            </li>
          }
        </ul>
      </figure>
    } @else if (status() === 'data') {
      <elv-viz-state status="empty" />
    }
  `,
  styles: [
    `
      :host { display: block; }
      .elv-donut { display: grid; grid-template-columns: minmax(7rem, 10rem) 1fr; align-items: center; gap: 1rem; margin: 0; }
      svg { width: 100%; color: var(--elv-viz-axis, currentColor); }
      .elv-donut__track, .elv-donut__slice { fill: none; stroke-width: 16; }
      .elv-donut__track { stroke: var(--elv-viz-grid, currentColor); stroke-opacity: 0.15; }
      .elv-donut__slice { stroke-linecap: butt; transition: stroke-dashoffset 180ms ease; }
      text { fill: currentColor; font-family: system-ui, sans-serif; }
      .elv-donut__total { font-size: 0.95rem; font-weight: 650; }
      .elv-donut__caption { font-size: 0.55rem; opacity: 0.75; }
      ul { list-style: none; padding: 0; margin: 0; }
      li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; font-size: 0.85rem; }
      li span:last-child { margin-inline-start: auto; font-variant-numeric: tabular-nums; }
      .elv-donut__swatch { width: 0.7rem; height: 0.7rem; border-radius: 50%; }
      @media (max-width: 32rem) { .elv-donut { grid-template-columns: 1fr; } }
    `,
  ],
})
export class ElvDonutChartComponent extends ElvStatefulUiComponent {
  readonly data = input.required<readonly ElvDonutSlice[]>();
  readonly ariaLabel = input('Distribution');
  readonly totalLabel = input('total');
  readonly status = input<ElvVizStatus>('data');
  readonly stale = input(false);
  readonly total = computed(() => this.data().reduce((sum, slice) => sum + Math.max(0, slice.value), 0));
  readonly viewModel = computed(() => {
    const total = this.total();
    let offset = 0;
    return this.data()
      .filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
      .map((slice) => {
        const percentage = total ? (slice.value / total) * 100 : 0;
        const dashOffset = -offset;
        offset += percentage;
        return {
          ...slice,
          percentage: Math.round(percentage * 10) / 10,
          dashArray: `${(percentage / 100) * 276.46} ${276.46 - (percentage / 100) * 276.46}`,
          dashOffset: (dashOffset / 100) * 276.46,
        };
      });
  });
  readonly summary = computed(() =>
    `${this.ariaLabel()}: ${this.viewModel().map((slice) => `${slice.label} ${slice.percentage}%`).join(', ')}`,
  );

  seriesColor(index: number): string {
    const token = DONUT_COLOR_TOKENS[index % DONUT_COLOR_TOKENS.length];
    return `var(--elv-viz-series-${(index % 6) + 1}, var(${token}, currentColor))`;
  }
}

@Component({
  selector: 'elv-heatmap',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'data') {
      <elv-viz-state [status]="status()" [stale]="stale()" />
    }
    @if (viewModel().length) {
      <figure class="elv-heatmap">
        <figcaption class="elv-heatmap__summary">{{ summary() }}</figcaption>
        <div class="elv-heatmap__grid" role="grid" [attr.aria-label]="ariaLabel()">
          @for (cell of viewModel(); track cell.y + ':' + cell.x) {
            <div
              class="elv-heatmap__cell"
              role="gridcell"
              [attr.aria-label]="cell.y + ', ' + cell.x + ': ' + cell.value"
              [style.background]="cellBackground(cell.intensity)"
              [title]="cell.y + ' / ' + cell.x + ': ' + cell.value"
            >
              <span>{{ cell.value }}</span>
              <small>{{ cell.x }}</small>
            </div>
          }
        </div>
      </figure>
    } @else if (status() === 'data') {
      <elv-viz-state status="empty" />
    }
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      figure { margin: 0; }
      .elv-heatmap__summary { margin-bottom: 0.5rem; }
      .elv-heatmap__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr)); gap: 0.25rem; }
      .elv-heatmap__cell {
        display: grid; min-height: 3.25rem; align-content: center; justify-items: center;
        border: 1px solid var(--elv-viz-border, currentColor); border-radius: 0.3rem;
        color: var(--elv-viz-heatmap-foreground, currentColor); padding: 0.35rem;
      }
      .elv-heatmap__cell small { font-size: 0.7rem; opacity: 0.8; }
    `,
  ],
})
export class ElvHeatmapComponent extends ElvStatefulUiComponent {
  readonly data = input.required<readonly ElvHeatmapCell[]>();
  readonly ariaLabel = input('Heatmap');
  readonly status = input<ElvVizStatus>('data');
  readonly stale = input(false);
  readonly viewModel = computed(() => buildHeatmapViewModel(this.data()));
  readonly summary = computed(
    () => `${this.ariaLabel()}, ${this.viewModel().length} cells`,
  );

  cellBackground(intensity: number): string {
    return `color-mix(in srgb, var(--elv-viz-heatmap, currentColor) ${intensity}%, transparent)`;
  }
}

export function buildHeatmapViewModel(
  cells: readonly ElvHeatmapCell[],
): readonly ElvHeatmapCellViewModel[] {
  const values = cells.map((cell) => cell.value).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return cells
    .filter((cell) => Number.isFinite(cell.value))
    .map((cell) => ({
      ...cell,
      intensity: range === 0 ? 50 : Math.round(((cell.value - min) / range) * 100),
    }));
}
