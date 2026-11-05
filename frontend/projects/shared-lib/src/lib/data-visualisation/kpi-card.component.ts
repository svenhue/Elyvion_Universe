import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ElvVizStatus } from './data-viz.types';
import { ElvVizStateComponent } from './viz-state.component';

export type ElvKpiStatus = 'neutral' | 'positive' | 'negative' | 'warning' | 'error';
export type ElvKpiTrend = 'up' | 'down' | 'flat';

@Component({
  selector: 'elv-kpi-card',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (dataStatus() !== 'data') {
      <elv-viz-state [status]="dataStatus()" [stale]="stale()" />
    }
    <article class="elv-kpi" [attr.data-status]="status()" [attr.aria-label]="accessibleLabel()">
      <div class="elv-kpi__header">
        <h3>{{ label() }}</h3>
        @if (status() !== 'neutral') {
          <span class="elv-kpi__status">{{ status() }}</span>
        }
      </div>
      <div class="elv-kpi__body">
        <p class="elv-kpi__value">{{ value() }}</p>
        @if (delta() !== null) {
          <p class="elv-kpi__delta" [attr.data-trend]="trend()">
            <span aria-hidden="true">{{ trendSymbol() }}</span>
            <span>{{ delta() }}{{ deltaUnit() }}</span>
            <span class="elv-kpi__sr-only">{{ trend() }} compared to previous period</span>
          </p>
        }
      </div>
      @if (sparklinePoints().length > 1) {
        <svg
          class="elv-kpi__sparkline"
          viewBox="0 0 100 32"
          role="img"
          [attr.aria-label]="sparklineLabel()"
        >
          <polyline [attr.points]="sparklinePoints().join(' ')" fill="none" stroke="currentColor" />
        </svg>
      }
    </article>
  `,
  styles: [
    `
      :host { display: block; }
      .elv-kpi {
        border: 1px solid var(--elv-viz-border, currentColor);
        border-radius: var(--elv-viz-radius, 0.75rem);
        padding: 1rem;
        background: var(--elv-viz-surface, transparent);
      }
      .elv-kpi__header, .elv-kpi__body {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
      }
      h3, p { margin: 0; }
      h3 { font-size: 0.875rem; font-weight: 500; }
      .elv-kpi__value { font-size: 1.75rem; font-weight: 650; }
      .elv-kpi__status, .elv-kpi__delta { font-size: 0.8rem; }
      .elv-kpi__delta[data-trend='up'] { color: var(--elv-viz-positive, currentColor); }
      .elv-kpi__delta[data-trend='down'] { color: var(--elv-viz-negative, currentColor); }
      .elv-kpi[data-status='warning'] { border-inline-start: 0.25rem solid var(--elv-viz-warning, currentColor); }
      .elv-kpi[data-status='error'] { border-inline-start: 0.25rem solid var(--elv-viz-error, currentColor); }
      .elv-kpi__sparkline { display: block; width: 100%; height: 2rem; margin-top: 0.75rem; }
      .elv-kpi__sr-only {
        position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
        overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
      }
    `,
  ],
})
export class ElvKpiCardComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly delta = input<number | null>(null);
  readonly deltaUnit = input('%');
  readonly trend = input<ElvKpiTrend>('flat');
  readonly sparkline = input<readonly number[]>([]);
  readonly status = input<ElvKpiStatus>('neutral');
  readonly dataStatus = input<ElvVizStatus>('data');
  readonly stale = input(false);

  readonly sparklinePoints = computed(() => {
    const values = this.sparkline();
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - ((value - min) / range) * 24;
      return `${x},${y}`;
    });
  });
  readonly trendSymbol = computed(() =>
    this.trend() === 'up' ? '↑' : this.trend() === 'down' ? '↓' : '→',
  );
  readonly accessibleLabel = computed(
    () => `${this.label()}: ${this.value()}${this.delta() === null ? '' : `, ${this.delta()}${this.deltaUnit()} ${this.trend()}`}`,
  );
  readonly sparklineLabel = computed(() => `${this.label()} trend over recent observations`);
}
