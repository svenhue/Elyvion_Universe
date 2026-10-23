import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvBadgeProperties extends ElvUiProperties {
  label?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'elv-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="elv-badge" [class]="'elv-badge elv-badge--' + (properties.tone ?? 'neutral') + ' ' + (properties.className ?? '')" [ngStyle]="properties.styles"><ng-content />{{ properties.label }}</span>`,
  styles: [`.elv-badge{display:inline-flex;align-items:center;border-radius:999px;padding:.2rem .6rem;font-size:.8rem;background:#e2e8f0;color:#334155}.elv-badge--success{background:#dcfce7;color:#166534}.elv-badge--warning{background:#fef3c7;color:#92400e}.elv-badge--danger{background:#fee2e2;color:#991b1b}`],
})
export class ElvBadgeComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvBadgeProperties = {};
}
