import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvAlertProperties extends ElvUiProperties {
  title?: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  dismissible?: boolean;
}

@Component({
  selector: 'elv-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!dismissed) {
      <section class="elv-alert" [class]="'elv-alert elv-alert--' + (properties.tone ?? 'info') + ' ' + (properties.className ?? '')" [ngStyle]="properties.styles" role="status">
        <div>@if (properties.title) { <strong>{{ properties.title }}</strong> }<ng-content />@if (properties.message) { {{ properties.message }} }</div>
        @if (properties.dismissible) { <button type="button" aria-label="Dismiss" (click)="dismiss()">×</button> }
      </section>
    }
  `,
  styles: [`.elv-alert{display:flex;justify-content:space-between;gap:1rem;padding:.8rem 1rem;border-radius:8px;background:#e0f2fe;color:#075985}.elv-alert--success{background:#dcfce7;color:#166534}.elv-alert--warning{background:#fef3c7;color:#92400e}.elv-alert--danger{background:#fee2e2;color:#991b1b}button{border:0;background:none;font:inherit;cursor:pointer}`],
})
export class ElvAlertComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvAlertProperties = {};

  get dismissed(): boolean {
    return this.stateValue('value') === true;
  }

  dismiss(): void {
    this.updateState('value', true);
  }
}
