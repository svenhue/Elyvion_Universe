import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ElvStatefulUiComponent } from '../ui/stateful-ui-component';
import { ElvDataTableColumn, ElvVizStatus } from './data-viz.types';
import { ElvVizStateComponent } from './viz-state.component';

@Component({
  selector: 'elv-data-table',
  standalone: true,
  imports: [ElvVizStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="elv-data-table">
      @if (dataStatus() !== 'data') {
        <elv-viz-state [status]="dataStatus()" [stale]="stale()" />
      }
      <label class="elv-data-table__filter">
        <span>{{ filterLabel() }}</span>
        <input type="search" [value]="filter()" (input)="setFilter($event)" />
      </label>
      @if (pageRows().length) {
        <div class="elv-data-table__scroll" tabindex="0" role="region" [attr.aria-label]="ariaLabel()">
          <table>
            <thead>
              <tr>
                @if (selectable()) { <th scope="col"><span class="elv-data-table__sr-only">Select row</span></th> }
                @for (column of columns(); track column.key) {
                  <th scope="col" [attr.aria-sort]="ariaSort(column.key)">
                    @if (column.sortable !== false) {
                      <button type="button" class="elv-data-table__sort" (click)="sortBy(column.key)">
                        {{ column.label }} @if (sortKey() === column.key) { {{ sortDirection() === 'asc' ? '↑' : '↓' }} }
                      </button>
                    } @else {
                      {{ column.label }}
                    }
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of pageRows(); track $index) {
                <tr>
                  @if (selectable()) {
                    <td>
                      <input
                        type="checkbox"
                        [checked]="selectedRows().includes(row)"
                        [attr.aria-label]="'Select row ' + rowLabel(row)"
                        (change)="toggleRow(row)"
                      />
                    </td>
                  }
                  @for (column of columns(); track column.key) {
                    <td>{{ displayValue(row[column.key]) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (dataStatus() === 'data') {
        <elv-viz-state status="empty" [message]="emptyMessage()" />
      }
      <nav class="elv-data-table__paging" aria-label="Table pages">
        <button type="button" [disabled]="currentPage() <= 0" (click)="goToPage(currentPage() - 1)">{{ previousLabel() }}</button>
        <span>{{ pageLabel() }} {{ currentPage() + 1 }} {{ ofLabel() }} {{ pageCount() }} · {{ filteredRows().length }} {{ rowsLabel() }}</span>
        <button type="button" [disabled]="currentPage() >= pageCount() - 1" (click)="goToPage(currentPage() + 1)">{{ nextLabel() }}</button>
      </nav>
    </section>
  `,
  styles: [
    `
      :host { display: block; min-width: 0; }
      .elv-data-table { color: var(--elv-viz-foreground, inherit); }
      .elv-data-table__filter { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
      input[type='search'] { color: inherit; background: var(--elv-viz-surface, transparent); border: 1px solid var(--elv-viz-border, currentColor); border-radius: 0.35rem; padding: 0.35rem 0.5rem; }
      .elv-data-table__scroll { overflow: auto; max-width: 100%; }
      table { width: 100%; border-collapse: collapse; text-align: start; font-size: 0.875rem; }
      th, td { padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--elv-viz-border, currentColor); }
      th { font-weight: 600; }
      tr:focus-within { outline: 2px solid var(--elv-viz-focus, currentColor); outline-offset: -2px; }
      button { color: inherit; background: transparent; border: 1px solid var(--elv-viz-border, currentColor); border-radius: 0.35rem; padding: 0.35rem 0.6rem; font: inherit; cursor: pointer; }
      button:focus-visible, input:focus-visible { outline: 2px solid var(--elv-viz-focus, currentColor); outline-offset: 2px; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      .elv-data-table__sort { border: 0; padding: 0; font-weight: inherit; }
      .elv-data-table__paging { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem; font-size: 0.8rem; }
      .elv-data-table__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    `,
  ],
})
export class ElvDataTableComponent<T extends Record<string, unknown> = Record<string, unknown>>
  extends ElvStatefulUiComponent {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly ElvDataTableColumn<T>[]>();
  readonly pageSize = input(10);
  readonly selectable = input(false);
  readonly ariaLabel = input('Data table');
  readonly filterLabel = input('Filter rows');
  readonly emptyMessage = input('No matching rows');
  readonly previousLabel = input('Previous');
  readonly nextLabel = input('Next');
  readonly pageLabel = input('Page');
  readonly ofLabel = input('of');
  readonly rowsLabel = input('rows');
  readonly dataStatus = input<ElvVizStatus>('data');
  readonly stale = input(false);
  readonly selectionChange = output<readonly T[]>();

  readonly filter = signal('');
  readonly page = signal(0);
  readonly sortKey = signal<keyof T & string | null>(null);
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly selectedRows = signal<readonly T[]>([]);

  readonly filteredRows = computed(() => {
    const query = this.filter().trim().toLocaleLowerCase();
    const rows = this.rows().filter((row) =>
      !query || this.columns().some((column) =>
        this.displayValue(row[column.key]).toLocaleLowerCase().includes(query),
      ),
    );
    const key = this.sortKey();
    if (!key) return rows;
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => direction * compareValues(a[key], b[key]));
  });
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / Math.max(1, this.pageSize()))),
  );
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly pageRows = computed(() => {
    const start = this.currentPage() * Math.max(1, this.pageSize());
    return this.filteredRows().slice(start, start + Math.max(1, this.pageSize()));
  });

  setFilter(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.filter.set(event.target.value);
    this.page.set(0);
  }

  sortBy(key: keyof T & string): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => direction === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
    this.page.set(0);
  }

  ariaSort(key: keyof T & string): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  goToPage(page: number): void {
    this.page.set(Math.min(this.pageCount() - 1, Math.max(0, page)));
  }

  toggleRow(row: T): void {
    const selected = this.selectedRows();
    const next = selected.includes(row) ? selected.filter((item) => item !== row) : [...selected, row];
    this.selectedRows.set(next);
    this.selectionChange.emit(next);
  }

  displayValue(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  rowLabel(row: T): string {
    return this.columns().map((column) => this.displayValue(row[column.key])).join(', ');
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}
