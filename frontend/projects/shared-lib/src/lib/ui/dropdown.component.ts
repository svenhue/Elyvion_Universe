import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvDropdownOption {
  label: string;
  value: string;
}

export interface ElvDropdownProperties extends ElvUiProperties {
  label?: string;
  options?: ElvDropdownOption[];
}

@Component({
  selector: 'elv-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="elv-dropdown" [ngClass]="properties.className" [ngStyle]="properties.styles">
      <button type="button" aria-haspopup="listbox" [attr.aria-expanded]="isOpen" (click)="toggle()">{{ selectedLabel }}</button>
      @if (isOpen) {
        <ul role="listbox">
          @for (option of properties.options ?? []; track option.value) {
            <li><button type="button" role="option" (click)="select(option.value)">{{ option.label }}</button></li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`.elv-dropdown{position:relative;display:inline-block}.elv-dropdown>button{padding:.55rem .8rem;border:1px solid #cbd5e1;border-radius:6px;background:white;font:inherit;cursor:pointer}.elv-dropdown ul{position:absolute;z-index:5;top:100%;left:0;min-width:100%;margin:.25rem 0;padding:.25rem;list-style:none;background:white;border:1px solid #e2e8f0;border-radius:6px;box-shadow:0 8px 20px #0f172a18}.elv-dropdown li button{width:100%;padding:.45rem;border:0;background:white;text-align:left;cursor:pointer}`],
})
export class ElvDropdownComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvDropdownProperties = {};

  get isOpen(): boolean {
    return this.stateValue('open') === true;
  }

  get selectedLabel(): string {
    const value = this.stateValue('value');
    if (typeof value === 'string') {
      return this.properties.options?.find((option) => option.value === value)?.label ?? value;
    }
    return this.properties.label ?? 'Select';
  }

  toggle(): void {
    this.updateState('open', !this.isOpen);
  }

  select(value: string): void {
    this.updateState('value', value);
  }
}
