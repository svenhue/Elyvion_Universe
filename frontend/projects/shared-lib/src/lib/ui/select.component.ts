import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvSelectOption {
  label: string;
  value: string;
}

export interface ElvSelectProperties extends ElvUiProperties {
  label?: string;
  placeholder?: string;
  value?: string;
  options?: ElvSelectOption[];
  disabled?: boolean;
}

@Component({
  selector: 'elv-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="elv-field" [ngClass]="properties.className" [ngStyle]="properties.styles">
      @if (properties.label) { <span>{{ properties.label }}</span> }
      <select [value]="selectedValue" [disabled]="properties.disabled ?? false" (change)="onChange($event)">
        @if (properties.placeholder) { <option value="">{{ properties.placeholder }}</option> }
        @for (option of properties.options ?? []; track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
    </label>
  `,
  styles: [`.elv-field{display:grid;gap:.35rem}select{font:inherit;padding:.55rem .7rem;border:1px solid #cbd5e1;border-radius:6px}`],
})
export class ElvSelectComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvSelectProperties = {};

  get selectedValue(): string {
    const value = this.stateValue('value');
    return typeof value === 'string' ? value : this.properties.value ?? '';
  }

  onChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.updateState('value', event.target.value);
    }
  }
}
