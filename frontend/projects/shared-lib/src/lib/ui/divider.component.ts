import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvDividerProperties extends ElvUiProperties {
  orientation?: 'horizontal' | 'vertical';
}

@Component({
  selector: 'elv-divider',
  standalone: true,
  imports: [CommonModule],
  template: `<hr [class]="'elv-divider elv-divider--' + (properties.orientation ?? 'horizontal') + ' ' + (properties.className ?? '')" [ngStyle]="properties.styles" />`,
  styles: [`.elv-divider{border:0;background:#e2e8f0}.elv-divider--horizontal{height:1px;width:100%;margin:1rem 0}.elv-divider--vertical{width:1px;height:100%;margin:0 1rem}`],
})
export class ElvDividerComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvDividerProperties = {};
}
