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
    <div
      [class]="'rounded-xl border border-slate-200 bg-white p-5 ' + (properties.className ?? '')"
      [ngStyle]="properties.styles"
    >
      @if (properties.title ?? title) {
        <h3 class="m-0 mb-3 text-base font-semibold">{{ properties.title ?? title }}</h3>
      }
      <div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ElvCardComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvCardProperties = {};
  @Input() title?: string;
}
