import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ElvButtonVariant = 'primary' | 'secondary' | 'ghost';

@Component({
  selector: 'elv-button',
  standalone: true,
  template: `
    <button
      [class]="'elv-button elv-button--' + variant"
      [disabled]="disabled"
      [type]="type"
      (click)="pressed.emit()"
    >
      <ng-content />
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
export class ElvButtonComponent {
  @Input() variant: ElvButtonVariant = 'primary';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() pressed = new EventEmitter<void>();
}
