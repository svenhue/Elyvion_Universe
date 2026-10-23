import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvFormFieldProperties extends ElvUiProperties {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

@Component({
  selector: 'elv-form-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="elv-form-field" [ngClass]="properties.className" [ngStyle]="properties.styles">
      @if (properties.label) { <label>{{ properties.label }}@if (properties.required) { <span aria-hidden="true"> *</span> }</label> }
      <ng-content />
      @if (properties.error) { <small class="elv-form-field__error" role="alert">{{ properties.error }}</small> }
      @else if (properties.hint) { <small>{{ properties.hint }}</small> }
    </div>
  `,
  styles: [`.elv-form-field{display:grid;gap:.35rem}.elv-form-field small{color:#64748b}.elv-form-field__error{color:#b91c1c!important}`],
})
export class ElvFormFieldComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvFormFieldProperties = {};
}
