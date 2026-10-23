import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvToggleProperties extends ElvUiProperties {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
}

@Component({
  selector: 'elv-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="elv-toggle" [ngClass]="properties.className" [ngStyle]="properties.styles">
      <input type="checkbox" role="switch" [checked]="checked" [disabled]="properties.disabled ?? false" (change)="onChange($event)" />
      <span class="elv-toggle__track"><span class="elv-toggle__thumb"></span></span>
      @if (properties.label) { <span>{{ properties.label }}</span> }
    </label>
  `,
  styles: [`.elv-toggle{display:inline-flex;align-items:center;gap:.55rem;cursor:pointer}.elv-toggle input{position:absolute;opacity:0}.elv-toggle__track{width:2.4rem;height:1.35rem;border-radius:2rem;background:#94a3b8;padding:.15rem;transition:background .15s}.elv-toggle__thumb{display:block;width:1.05rem;height:1.05rem;border-radius:50%;background:white;transition:transform .15s}.elv-toggle input:checked+.elv-toggle__track{background:#6366f1}.elv-toggle input:checked+.elv-toggle__track .elv-toggle__thumb{transform:translateX(1.05rem)}`],
})
export class ElvToggleComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvToggleProperties = {};

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
