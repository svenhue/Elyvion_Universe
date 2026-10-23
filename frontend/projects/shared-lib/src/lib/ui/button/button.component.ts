import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ElvUiProperties } from '../ui-properties';
import { ElvStatefulUiComponent } from '../stateful-ui-component';

export type ElvButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ElvButtonProperties extends ElvUiProperties {
  variant?: ElvButtonVariant;
  disabled?: boolean;
  type?: 'button' | 'submit';
  label?: string;
}

const VARIANT_CLASSES: Record<ElvButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
  ghost: 'bg-transparent border border-slate-300 text-current hover:bg-slate-50',
};

@Component({
  selector: 'elv-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="
        'font-sans font-semibold rounded-lg px-4 py-2 border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' +
        variantClass() +
        ' ' +
        (properties.className ?? '')
      "
      [ngStyle]="properties.styles"
      [disabled]="properties.disabled ?? disabled"
      [type]="properties.type ?? type"
      (click)="pressed.emit()"
    >
      @if (properties.label ?? label) {
        {{ properties.label ?? label }}
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class ElvButtonComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvButtonProperties = {};
  @Input() variant: ElvButtonVariant = 'primary';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  /** Text content for schema-driven rendering, where there's no template to project `<ng-content>` into. */
  @Input() label?: string;
  @Output() pressed = new EventEmitter<void>();

  protected variantClass(): string {
    return VARIANT_CLASSES[this.properties.variant ?? this.variant] + (this.variant === 'ghost' || this.properties.variant === 'ghost' ? '' : ' border-transparent');
  }
}
