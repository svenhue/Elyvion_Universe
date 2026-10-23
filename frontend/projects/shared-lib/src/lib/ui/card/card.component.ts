import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from '../ui-properties';
import { ElvStatefulUiComponent } from '../stateful-ui-component';

export interface ElvCardProperties extends ElvUiProperties {
  title?: string;
}

@Component({
  selector: 'elv-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="elv-card" [ngClass]="properties.className" [ngStyle]="properties.styles">
      @if (properties.title ?? title) {
        <h3 class="elv-card__title">{{ properties.title ?? title }}</h3>
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
export class ElvCardComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvCardProperties = {};
  @Input() title?: string;
}
