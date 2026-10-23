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

@Component({
  selector: 'elv-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="'elv-button elv-button--' + (properties.variant ?? variant) + ' ' + (properties.className ?? '')"
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
  styles: [
    `
      .elv-button {
        font-family: inherit;
        font-weight: 600;
        border-radius: 8px;
        padding: 0.55rem 1.1rem;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .elv-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .elv-button--primary {
        background: #6366f1;
        color: #fff;
      }
      .elv-button--primary:not(:disabled):hover {
        background: #4f46e5;
      }
      .elv-button--secondary {
        background: #e2e8f0;
        color: #0f172a;
      }
      .elv-button--ghost {
        background: transparent;
        border-color: #cbd5e1;
        color: inherit;
      }
    `,
  ],
})
export class ElvButtonComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvButtonProperties = {};
  @Input() variant: ElvButtonVariant = 'primary';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  /** Text content for schema-driven rendering, where there's no template to project `<ng-content>` into. */
  @Input() label?: string;
  @Output() pressed = new EventEmitter<void>();
}
