import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvSliderProperties extends ElvUiProperties {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  disabled?: boolean;
}

@Component({
  selector: 'elv-slider',
  standalone: true,
  imports: [CommonModule],
  template: `
    <input class="elv-slider" type="range" [ngClass]="properties.className" [ngStyle]="properties.styles"
      [min]="properties.min ?? 0" [max]="properties.max ?? 100" [step]="properties.step ?? 1"
      [value]="numericValue" [disabled]="properties.disabled ?? false" (input)="onInput($event)" />
  `,
  styles: [`.elv-slider{accent-color:#6366f1}`],
})
export class ElvSliderComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvSliderProperties = {};

  get numericValue(): number {
    const value = this.stateValue('value');
    return typeof value === 'number' ? value : this.properties.value ?? 0;
  }

  onInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.updateState('value', event.target.valueAsNumber);
    }
  }
}
