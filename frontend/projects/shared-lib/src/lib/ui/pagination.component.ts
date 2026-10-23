import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ElvUiProperties } from './ui-properties';
import { ElvStatefulUiComponent } from './stateful-ui-component';

export interface ElvPaginationProperties extends ElvUiProperties {
  pageCount: number;
  initialPage?: number;
}

@Component({
  selector: 'elv-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="elv-pagination" [ngClass]="properties.className" [ngStyle]="properties.styles" aria-label="Pagination">
      <button type="button" [disabled]="page <= 1" (click)="goTo(page - 1)">Previous</button>
      <span>Page {{ page }} of {{ pageCount }}</span>
      <button type="button" [disabled]="page >= pageCount" (click)="goTo(page + 1)">Next</button>
    </nav>
  `,
  styles: [`.elv-pagination{display:flex;align-items:center;gap:.75rem}.elv-pagination button{padding:.4rem .65rem;border:1px solid #cbd5e1;border-radius:5px;background:white;font:inherit}.elv-pagination button:disabled{opacity:.5}`],
})
export class ElvPaginationComponent extends ElvStatefulUiComponent {
  @Input() properties: ElvPaginationProperties = { pageCount: 1 };

  get pageCount(): number {
    return Math.max(1, Math.floor(this.properties.pageCount));
  }

  get page(): number {
    const stateValue = this.stateValue('value');
    const value = typeof stateValue === 'number' ? stateValue : this.properties.initialPage ?? 1;
    return Math.min(this.pageCount, Math.max(1, Math.floor(value)));
  }

  goTo(page: number): void {
    this.updateState('value', Math.min(this.pageCount, Math.max(1, page)));
  }
}
