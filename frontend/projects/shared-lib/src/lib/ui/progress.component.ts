import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvProgressProperties extends ElvUiProperties {
  value?: number;
  max?: number;
  label?: string;
}

@Component({
  selector: 'elv-progress',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="elv-progress" [ngClass]="properties.className" [ngStyle]="properties.styles"><progress [value]="progressValue" [max]="properties.max ?? 100"></progress>@if (properties.label) { <span>{{ properties.label }}</span> }</div>`,
  styles: [`.elv-progress{display:flex;align-items:center;gap:.6rem}progress{width:100%;accent-color:#6366f1}`],
})
export class ElvProgressComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvProgressProperties = {};

  get progressValue(): number {
    return this.properties.value ?? 0;
  }
}
