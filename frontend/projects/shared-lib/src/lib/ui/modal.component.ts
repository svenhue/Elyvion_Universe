import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvModalProperties extends ElvUiProperties {
  title?: string;
  closeLabel?: string;
}

@Component({
  selector: 'elv-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen) {
      <div class="elv-modal-backdrop" [ngStyle]="properties.styles" (click)="close()">
        <section class="elv-modal" [ngClass]="properties.className" role="dialog" aria-modal="true" [attr.aria-label]="properties.title ?? 'Dialog'" (click)="$event.stopPropagation()">
          <header>@if (properties.title) { <h2>{{ properties.title }}</h2> }<button type="button" (click)="close()">{{ properties.closeLabel ?? 'Close' }}</button></header>
          <ng-content />
        </section>
      </div>
    }
  `,
  styles: [`.elv-modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:#0f172a80}.elv-modal{width:min(100%,36rem);max-height:90vh;overflow:auto;padding:1.25rem;border-radius:12px;background:white;box-shadow:0 20px 50px #0f172a40}.elv-modal header{display:flex;justify-content:space-between;align-items:center;gap:1rem}.elv-modal h2{margin:0;font-size:1.15rem}button{font:inherit}`],
})
export class ElvModalComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvModalProperties = {};

  get isOpen(): boolean {
    return this.stateValue('value') === true;
  }

  close(): void {
    this.updateState('value', false);
  }
}
