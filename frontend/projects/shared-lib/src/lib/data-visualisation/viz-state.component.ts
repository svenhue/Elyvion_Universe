import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ElvVizStatus } from './data-viz.types';

const STATE_MESSAGES: Record<ElvVizStatus, string> = {
  loading: 'Loading data',
  empty: 'No data available',
  error: 'Data could not be loaded',
  'no-permission': 'You do not have permission to view this data',
  data: '',
  closed: 'Data stream disconnected',
};

@Component({
  selector: 'elv-viz-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'data') {
      <div
        class="elv-viz-state"
        [class.elv-viz-state--error]="status() === 'error'"
        role="status"
        aria-live="polite"
      >
        <span>{{ message() || defaultMessage() }}</span>
        @if (stale()) {
          <span class="elv-viz-state__stale">Showing last available data</span>
        }
      </div>
    }
  `,
  styles: [
    `
      .elv-viz-state {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
        color: var(--elv-viz-muted, currentColor);
        padding: 1rem;
      }
      .elv-viz-state--error {
        color: var(--elv-viz-error, currentColor);
      }
      .elv-viz-state__stale {
        font-size: 0.8em;
        opacity: 0.8;
      }
    `,
  ],
})
export class ElvVizStateComponent {
  readonly status = input.required<ElvVizStatus>();
  readonly stale = input(false);
  readonly message = input('');
  readonly defaultMessage = () => STATE_MESSAGES[this.status()];
}
