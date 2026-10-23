import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvTextareaProperties extends ElvUiProperties {
  placeholder?: string;
  label?: string;
  value?: string;
  rows?: number;
  disabled?: boolean;
}

@Component({
  selector: 'elv-textarea',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="elv-field" [ngClass]="properties.className" [ngStyle]="properties.styles">
      @if (properties.label) { <span>{{ properties.label }}</span> }
      <textarea
        [placeholder]="properties.placeholder ?? ''"
        [rows]="properties.rows ?? 4"
        [value]="textValue"
        [disabled]="properties.disabled ?? false"
        (input)="onInput($event)"
      ></textarea>
    </label>
  `,
  styles: [`.elv-field{display:grid;gap:.35rem}textarea{font:inherit;padding:.55rem .7rem;border:1px solid #cbd5e1;border-radius:6px;resize:vertical}`],
})
export class ElvTextareaComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvTextareaProperties = {};

  get textValue(): string {
    const value = this.stateValue('value');
    return typeof value === 'string' ? value : this.properties.value ?? '';
  }

  onInput(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.updateState('value', event.target.value);
    }
  }
}
