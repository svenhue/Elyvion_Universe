import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvSpinnerProperties extends ElvUiProperties {
  size?: string;
  label?: string;
}

@Component({
  selector: 'elv-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="elv-spinner" [ngClass]="properties.className" [ngStyle]="spinnerStyles" role="status"><span class="elv-spinner__ring"></span><span class="elv-spinner__label">{{ properties.label ?? 'Loading' }}</span></span>`,
  styles: [`.elv-spinner{display:inline-flex;align-items:center;gap:.5rem}.elv-spinner__ring{width:var(--elv-spinner-size,1.25rem);height:var(--elv-spinner-size,1.25rem);border:2px solid #cbd5e1;border-top-color:#6366f1;border-radius:50%;animation:elv-spin .7s linear infinite}.elv-spinner__label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@keyframes elv-spin{to{transform:rotate(360deg)}}`],
})
export class ElvSpinnerComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvSpinnerProperties = {};

  get spinnerStyles(): Record<string, string | number> {
    return { ...this.properties.styles, '--elv-spinner-size': this.properties.size ?? '1.25rem' };
  }
}
