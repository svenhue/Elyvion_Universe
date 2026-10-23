import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvTextInputProperties extends ElvUiProperties {
  type?: 'text' | 'email' | 'password' | 'search' | 'number';
  placeholder?: string;
  label?: string;
  value?: string;
  disabled?: boolean;
}

@Component({
  selector: 'elv-text-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="elv-field" [ngClass]="properties.className" [ngStyle]="properties.styles">
      @if (properties.label) { <span>{{ properties.label }}</span> }
      <input
        [type]="properties.type ?? 'text'"
        [placeholder]="properties.placeholder ?? ''"
        [value]="textValue"
        [disabled]="properties.disabled ?? false"
        (input)="onInput($event)"
      />
    </label>
  `,
  styles: [`.elv-field{display:grid;gap:.35rem}input{font:inherit;padding:.55rem .7rem;border:1px solid #cbd5e1;border-radius:6px}`],
})
export class ElvTextInputComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvTextInputProperties = {};

  get textValue(): string {
    const value = this.stateValue('value');
    return typeof value === 'string' ? value : this.properties.value ?? '';
  }

  onInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateState('value', event.target.value);
    }
  }
}
