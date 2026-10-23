import { Component, Input } from '@angular/core';

@Component({
  selector: 'elv-card',
  standalone: true,
  template: `
    <div class="elv-card">
      @if (title) {
        <h3 class="elv-card__title">{{ title }}</h3>
      }
      <div class="elv-card__body">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .elv-card {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.25rem;
        background: #fff;
      }
      .elv-card__title {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        font-weight: 600;
      }
    `,
  ],
})
export class ElvCardComponent {
  @Input() title?: string;
}
