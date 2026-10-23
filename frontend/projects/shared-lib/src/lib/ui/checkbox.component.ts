import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvCheckboxProperties extends ElvUiProperties {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'elv-checkbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="elv-control" [ngClass]="properties.className" [ngStyle]="properties.styles">
      <input type="checkbox" [checked]="checked" [disabled]="properties.disabled ?? false" (change)="onChange($event)" />
      @if (properties.label) { <span>{{ properties.label }}</span> }
    </label>
  `,
  styles: [`.elv-control{display:inline-flex;align-items:center;gap:.5rem;cursor:pointer}`],
})
export class ElvCheckboxComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvCheckboxProperties = {};

  get checked(): boolean {
    const value = this.stateValue('value');
    return typeof value === 'boolean' ? value : this.properties.checked ?? false;
  }

  onChange(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateState('value', event.target.checked);
    }
  }
}
