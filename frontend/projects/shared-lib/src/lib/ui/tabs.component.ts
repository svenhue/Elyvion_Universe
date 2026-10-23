import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvTabsItem {
  label: string;
  value: string;
}

export interface ElvTabsProperties extends ElvUiProperties {
  items: ElvTabsItem[];
}

@Component({
  selector: 'elv-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [ngClass]="properties.className" [ngStyle]="properties.styles">
      <div class="elv-tabs" role="tablist">
        @for (item of properties.items; track item.value) {
          <button type="button" role="tab" [attr.aria-selected]="activeValue === item.value" [class.active]="activeValue === item.value" (click)="select(item.value)">{{ item.label }}</button>
        }
      </div>
      <ng-content />
    </div>
  `,
  styles: [`.elv-tabs{display:flex;gap:.25rem;border-bottom:1px solid #e2e8f0}.elv-tabs button{padding:.55rem .8rem;border:0;border-bottom:2px solid transparent;background:none;font:inherit;cursor:pointer}.elv-tabs button.active{border-color:#6366f1;color:#4f46e5}`],
})
export class ElvTabsComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvTabsProperties = { items: [] };

  get activeValue(): string {
    const value = this.stateValue('value');
    return typeof value === 'string' ? value : this.properties.items[0]?.value ?? '';
  }

  select(value: string): void {
    this.updateState('value', value);
  }
}
