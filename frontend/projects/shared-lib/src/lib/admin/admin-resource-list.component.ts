import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AdminApiService } from './admin-api.service';
import { ADMIN_RESOURCES, AdminField } from './admin-resource';

@Component({
  selector: 'elv-admin-resource-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (resource(); as r) {
      <div class="elv-admin-list">
        <div class="elv-admin-list__header">
          <h2>{{ r.label }}</h2>
          @if (r.creatable !== false) {
            <a [routerLink]="['new']" class="elv-admin-btn">+ Neu</a>
          }
        </div>

        @if (loading()) {
          <p>Lädt …</p>
        } @else if (error()) {
          <p class="elv-admin-error">{{ error() }}</p>
        } @else if (items().length === 0) {
          <p class="elv-admin-empty">Keine Einträge.</p>
        } @else {
          <table class="elv-admin-table">
            <thead>
              <tr>
                @for (col of columns(); track col.key) {
                  <th>{{ col.label }}</th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item[resource()!.idField]) {
                <tr>
                  @for (col of columns(); track col.key) {
                    <td>{{ displayValue(item, col) }}</td>
                  }
                  <td class="elv-admin-table__actions">
                    @if (r.editable !== false) {
                      <a [routerLink]="[item[r.idField], 'edit']">Bearbeiten</a>
                    }
                    @if (r.deletable !== false) {
                      <button type="button" (click)="delete(item)">Löschen</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    } @else {
      <p>Unbekannte Ressource.</p>
    }
  `,
  styles: [
    `
      .elv-admin-list__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }
      .elv-admin-list__header h2 {
        margin: 0;
      }
      .elv-admin-btn {
        background: #6366f1;
        color: #fff;
        padding: 0.45rem 0.9rem;
        border-radius: 6px;
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .elv-admin-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .elv-admin-table th,
      .elv-admin-table td {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e2e8f0;
        max-width: 320px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .elv-admin-table__actions {
        display: flex;
        gap: 0.75rem;
        white-space: nowrap;
      }
      .elv-admin-table__actions button {
        background: none;
        border: none;
        color: #dc2626;
        cursor: pointer;
        padding: 0;
        font-size: 0.85rem;
      }
      .elv-admin-error {
        color: #dc2626;
      }
      .elv-admin-empty {
        color: #64748b;
      }
    `,
  ],
})
export class AdminResourceListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly resources = inject(ADMIN_RESOURCES);
  private readonly api = inject(AdminApiService);

  private readonly resourceId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('resourceId') ?? '')),
    { initialValue: '' },
  );

  protected readonly resource = computed(() =>
    this.resources.find((r) => r.id === this.resourceId()),
  );

  protected readonly items = signal<Record<string, unknown>[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const resource = this.resource();
      if (resource) this.load();
    });
  }

  protected columns(): AdminField[] {
    return this.resource()?.fields.filter((f) => f.inList !== false) ?? [];
  }

  protected displayValue(item: Record<string, unknown>, field: AdminField): string {
    const value = item[field.key];
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  protected delete(item: Record<string, unknown>): void {
    const resource = this.resource();
    if (!resource) return;
    const id = String(item[resource.idField]);
    if (!confirm(`"${id}" wirklich löschen?`)) return;

    this.api.remove(resource, id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Löschen fehlgeschlagen.'),
    });
  }

  private load(): void {
    const resource = this.resource();
    if (!resource) return;
    this.loading.set(true);
    this.error.set(null);
    this.api.list(resource).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Laden fehlgeschlagen.');
        this.loading.set(false);
      },
    });
  }
}
