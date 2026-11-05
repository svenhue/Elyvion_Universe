import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';
import { ElvStatefulUiComponent } from '../ui/stateful-ui-component';
import { buildCartesianChartViewModel } from './chart-view-model';
import { ElvChartKind, ElvChartSeries, ElvVizStatus } from './data-viz.types';
import { ElvVizStateComponent } from './viz-state.component';

const SERIES_COLOR_TOKENS = [
  '--color-blue-600',
  '--color-emerald-600',
  '--color-violet-600',
  '--color-amber-600',
  '--color-rose-600',
  '--color-cyan-600',
];

@Component({
  selector: 'elv-cartesian-chart-renderer',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'data') {
      <elv-viz-state [status]="status()" [stale]="stale()" />
    }
    @if (series().length) {
      <figure class="elv-chart">
        <svg
          [attr.viewBox]="'0 0 ' + model().width + ' ' + model().height"
          role="img"
          [attr.aria-label]="ariaLabel() + '. ' + model().summary"
        >
          @for (tick of model().yTicks; track $index) {
            <line
              [attr.x1]="model().plotLeft"
              [attr.x2]="model().plotLeft + model().plotWidth"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
              class="elv-chart__grid"
            />
            <text [attr.x]="model().plotLeft - 8" [attr.y]="tick.y + 4" text-anchor="end">
              {{ tick.label }}
            </text>
          }
          @for (tick of model().xTicks; track $index) {
            <text [attr.x]="tick.x" [attr.y]="model().height - 10" text-anchor="middle">
              {{ tick.label }}
            </text>
          }
          @for (item of model().series; track item.name; let seriesIndex = $index) {
            @switch (kind()) {
              @case ('line') {
                <path [attr.d]="item.linePath" [attr.stroke]="seriesColor(item.color, seriesIndex)" class="elv-chart__line" />
              }
              @case ('area') {
                <path [attr.d]="item.areaPath" [attr.fill]="seriesColor(item.color, seriesIndex)" class="elv-chart__area" />
                <path [attr.d]="item.linePath" [attr.stroke]="seriesColor(item.color, seriesIndex)" class="elv-chart__line" />
              }
              @case ('scatter') {
                @for (point of item.points; track $index) {
                  <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4" [attr.fill]="seriesColor(item.color, seriesIndex)">
                    <title>{{ item.name }} — {{ point.label }}: {{ point.value }}</title>
                  </circle>
                }
              }
              @case ('bar') {
                @for (point of item.points; track $index) {
                  <rect
                    [attr.x]="point.barX"
                    [attr.y]="point.barY"
                    [attr.width]="point.barWidth"
                    [attr.height]="point.barHeight"
                    [attr.fill]="seriesColor(item.color, seriesIndex)"
                  >
                    <title>{{ item.name }} — {{ point.label }}: {{ point.value }}</title>
                  </rect>
                }
              }
              @case ('stacked-bar') {
                @for (point of item.points; track $index) {
                  <rect
                    [attr.x]="point.barX"
                    [attr.y]="point.barY"
                    [attr.width]="point.barWidth"
                    [attr.height]="point.barHeight"
                    [attr.fill]="seriesColor(item.color, seriesIndex)"
                  >
                    <title>{{ item.name }} — {{ point.label }}: {{ point.value }}</title>
                  </rect>
                }
              }
            }
          }
        </svg>
        <ul class="elv-chart__legend" [attr.aria-label]="legendLabel()">
          @for (item of model().series; track item.name; let index = $index) {
            <li>
              <span class="elv-chart__swatch" [style.background-color]="seriesColor(item.color, index)"></span>
              {{ item.name }}
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
      :host { display: block; min-width: 0; }
      .elv-chart { margin: 0; }
      svg { display: block; width: 100%; height: auto; overflow: visible; color: var(--elv-viz-axis, currentColor); }
      text { fill: currentColor; font: 11px system-ui, sans-serif; }
      .elv-chart__grid { stroke: var(--elv-viz-grid, currentColor); stroke-opacity: 0.18; }
      .elv-chart__line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
      .elv-chart__area { fill-opacity: 0.2; stroke: none; }
      .elv-chart__legend { display: flex; flex-wrap: wrap; gap: 0.75rem; list-style: none; margin: 0.5rem 0 0; padding: 0; font-size: 0.8rem; }
      .elv-chart__legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
      .elv-chart__swatch { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 50%; }
    `,
  ],
})
export class ElvCartesianChartRendererComponent {
  readonly series = input.required<readonly ElvChartSeries[]>();
  readonly kind = input.required<ElvChartKind>();
  readonly ariaLabel = input.required<string>();
  readonly legendLabel = input('Chart legend');
  readonly status = input<ElvVizStatus>('data');
  readonly stale = input(false);
  readonly model = computed(() => buildCartesianChartViewModel(this.series(), this.kind()));

  seriesColor(color: string | undefined, index: number): string {
    const token = SERIES_COLOR_TOKENS[index % SERIES_COLOR_TOKENS.length];
    return color ?? `var(--elv-viz-series-${(index % 6) + 1}, var(${token}, currentColor))`;
  }
}

@Directive()
abstract class ElvCartesianChartComponent extends ElvStatefulUiComponent {
  readonly series = input.required<readonly ElvChartSeries[]>();
  readonly ariaLabel = input.required<string>();
  readonly status = input<ElvVizStatus>('data');
  readonly stale = input(false);
  abstract readonly kind: ElvChartKind;
  readonly model = computed(() => buildCartesianChartViewModel(this.series(), this.kind));
}

@Component({
  selector: 'elv-line-chart',
  standalone: true,
  imports: [ElvCartesianChartRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<elv-cartesian-chart-renderer [series]="series()" kind="line" [ariaLabel]="ariaLabel()" [status]="status()" [stale]="stale()" />`,
})
export class ElvLineChartComponent extends ElvCartesianChartComponent {
  override readonly kind = 'line' as const;
}

@Component({
  selector: 'elv-area-chart',
  standalone: true,
  imports: [ElvCartesianChartRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<elv-cartesian-chart-renderer [series]="series()" kind="area" [ariaLabel]="ariaLabel()" [status]="status()" [stale]="stale()" />`,
})
export class ElvAreaChartComponent extends ElvCartesianChartComponent {
  override readonly kind = 'area' as const;
}

@Component({
  selector: 'elv-bar-chart',
  standalone: true,
  imports: [ElvCartesianChartRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<elv-cartesian-chart-renderer [series]="series()" kind="bar" [ariaLabel]="ariaLabel()" [status]="status()" [stale]="stale()" />`,
})
export class ElvBarChartComponent extends ElvCartesianChartComponent {
  override readonly kind = 'bar' as const;
}

@Component({
  selector: 'elv-stacked-bar-chart',
  standalone: true,
  imports: [ElvCartesianChartRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<elv-cartesian-chart-renderer [series]="series()" kind="stacked-bar" [ariaLabel]="ariaLabel()" [status]="status()" [stale]="stale()" />`,
})
export class ElvStackedBarChartComponent extends ElvCartesianChartComponent {
  override readonly kind = 'stacked-bar' as const;
}

@Component({
  selector: 'elv-scatter-chart',
  standalone: true,
  imports: [ElvCartesianChartRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<elv-cartesian-chart-renderer [series]="series()" kind="scatter" [ariaLabel]="ariaLabel()" [status]="status()" [stale]="stale()" />`,
})
export class ElvScatterChartComponent extends ElvCartesianChartComponent {
  override readonly kind = 'scatter' as const;
}
