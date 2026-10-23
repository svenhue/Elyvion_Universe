import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvTooltipProperties extends ElvUiProperties {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

@Component({
  selector: 'elv-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="elv-tooltip" [class]="'elv-tooltip elv-tooltip--' + (properties.position ?? 'top') + ' ' + (properties.className ?? '')"
      [ngStyle]="properties.styles" (mouseenter)="updateState('value', true)" (mouseleave)="updateState('value', false)" (focusin)="updateState('value', true)" (focusout)="updateState('value', false)">
      <ng-content />
      @if (visible) { <span class="elv-tooltip__content" role="tooltip">{{ properties.text }}</span> }
    </span>
  `,
  styles: [`.elv-tooltip{position:relative;display:inline-flex}.elv-tooltip__content{position:absolute;z-index:10;white-space:nowrap;padding:.35rem .55rem;border-radius:4px;background:#0f172a;color:#fff;font-size:.8rem;bottom:calc(100% + .4rem);left:50%;transform:translateX(-50%)}.elv-tooltip--bottom .elv-tooltip__content{top:calc(100% + .4rem);bottom:auto}`],
})
export class ElvTooltipComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvTooltipProperties = { text: '' };

  get visible(): boolean {
    return this.stateValue('value') === true;
  }
}
