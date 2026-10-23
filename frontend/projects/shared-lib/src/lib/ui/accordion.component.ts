import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvAccordionProperties extends ElvUiProperties {
  title: string;
  expanded?: boolean;
}

@Component({
  selector: 'elv-accordion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="elv-accordion" [ngClass]="properties.className" [ngStyle]="properties.styles">
      <button type="button" [attr.aria-expanded]="expanded" (click)="toggle()">{{ properties.title }}<span aria-hidden="true">{{ expanded ? '−' : '+' }}</span></button>
      @if (expanded) { <div class="elv-accordion__body"><ng-content /></div> }
    </section>
  `,
  styles: [`.elv-accordion{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.elv-accordion>button{width:100%;display:flex;justify-content:space-between;padding:.8rem 1rem;border:0;background:#f8fafc;text-align:left;font:inherit;cursor:pointer}.elv-accordion__body{padding:1rem}`],
})
export class ElvAccordionComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvAccordionProperties = { title: '' };

  get expanded(): boolean {
    const value = this.stateValue('value');
    return typeof value === 'boolean' ? value : this.properties.expanded ?? false;
  }

  toggle(): void {
    this.updateState('value', !this.expanded);
  }
}
