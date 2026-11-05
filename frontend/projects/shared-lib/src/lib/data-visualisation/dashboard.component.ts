import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ElvStatefulUiComponent } from '../ui/stateful-ui-component';
import { ElvDashboardFilter, ElvDashboardWidgetConfig, ElvVizStatus } from './data-viz.types';
import { ElvVizStateComponent } from './viz-state.component';

@Component({
  selector: 'elv-dashboard-widget',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="elv-dashboard-widget" [attr.aria-labelledby]="titleId() || null">
      <header>
        <div>
          <h2 [id]="titleId()">{{ title() }}</h2>
          @if (description()) { <p>{{ description() }}</p> }
        </div>
        @if (live()) { <span class="elv-dashboard-widget__live"><span aria-hidden="true"></span>{{ liveLabel() }}</span> }
        <ng-content select="[widget-actions]" />
      </header>
      @if (status() && status() !== 'data') {
        <elv-viz-state [status]="status()!" [stale]="status() === 'closed'" />
      }
      <div class="elv-dashboard-widget__content"><ng-content /></div>
    </article>
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      article { height: 100%; border: 1px solid var(--elv-viz-border, currentColor); border-radius: var(--elv-viz-radius, 0.75rem); background: var(--elv-viz-surface, transparent); }
      header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem 1rem 0.5rem; }
      h2, p { margin: 0; }
      h2 { font-size: 1rem; font-weight: 600; }
      p { margin-top: 0.25rem; font-size: 0.85rem; opacity: 0.8; }
      .elv-dashboard-widget__live { display: inline-flex; align-items: center; gap: 0.35rem; margin-inline-start: auto; font-size: 0.75rem; }
      .elv-dashboard-widget__live span { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--elv-viz-positive, currentColor); }
      .elv-dashboard-widget__content { min-width: 0; padding: 0.75rem 1rem 1rem; }
    `,
  ],
})
export class ElvDashboardWidgetComponent extends ElvStatefulUiComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly status = input<ElvVizStatus | null>(null);
  readonly live = input(false);
  readonly titleId = input('');
  readonly liveLabel = input('Live');
}

@Component({
  selector: 'elv-dashboard-grid',
  standalone: true,
  imports: [CommonModule, ElvDashboardWidgetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="elv-dashboard">
      @if (filters().length) {
        <div class="elv-dashboard__filters" aria-label="Dashboard filters">
          @for (filter of filters(); track filter.key) {
            <label>
              <span>{{ filter.label }}</span>
              <select [value]="filter.value ?? ''" (change)="changeFilter(filter.key, $event)">
                @for (option of filter.options; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </label>
          }
        </div>
      }
      <div class="elv-dashboard__grid">
        @for (widget of widgets(); track widget.id) {
          <elv-dashboard-widget
            [title]="widget.title"
            [description]="widget.description ?? ''"
            [status]="widget.status ?? null"
            [live]="widget.live ?? false"
            [titleId]="widget.id + '-title'"
            [ngClass]="'elv-dashboard__widget--span-' + (widget.columns ?? 1)"
          >
            <ng-container [ngTemplateOutlet]="widget.template" />
          </elv-dashboard-widget>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      .elv-dashboard__filters { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
      .elv-dashboard__filters label { display: grid; gap: 0.25rem; font-size: 0.85rem; }
      select { color: inherit; background: var(--elv-viz-surface, transparent); border: 1px solid var(--elv-viz-border, currentColor); border-radius: 0.35rem; padding: 0.4rem 0.55rem; font: inherit; }
      select:focus-visible { outline: 2px solid var(--elv-viz-focus, currentColor); outline-offset: 2px; }
      .elv-dashboard__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; align-items: stretch; }
      .elv-dashboard__widget--span-1 { grid-column: span 1; }
      .elv-dashboard__widget--span-2 { grid-column: span 2; }
      .elv-dashboard__widget--span-3 { grid-column: span 3; }
      .elv-dashboard__widget--span-4 { grid-column: span 4; }
      @media (max-width: 64rem) {
        .elv-dashboard__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .elv-dashboard__widget--span-3, .elv-dashboard__widget--span-4 { grid-column: span 2; }
      }
      @media (max-width: 40rem) {
        .elv-dashboard__grid { grid-template-columns: minmax(0, 1fr); }
        .elv-dashboard__grid > * { grid-column: span 1; }
      }
    `,
  ],
})
export class ElvDashboardGridComponent extends ElvStatefulUiComponent {
  readonly widgets = input.required<readonly ElvDashboardWidgetConfig[]>();
  readonly filters = input<readonly ElvDashboardFilter[]>([]);
  readonly filterChange = output<{ key: string; value: string }>();

  changeFilter(key: string, event: Event): void {
    if (!(event.target instanceof HTMLSelectElement)) return;
    this.filterChange.emit({ key, value: event.target.value });
  }
}
