import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AdminApiService } from './admin-api.service';
import { ADMIN_RESOURCES, AdminField } from './admin-resource';

@Component({
  selector: 'elv-admin-resource-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (resource(); as r) {
      <div class="elv-admin-form">
        <h2>{{ isEdit() ? 'Bearbeiten' : 'Neu' }}: {{ r.label }}</h2>

        @if (error()) {
          <p class="elv-admin-error">{{ error() }}</p>
        }

        <form (ngSubmit)="submit()">
          @for (field of editableFields(); track field.key) {
            <label class="elv-admin-form__field">
              <span>{{ field.label }}{{ field.required ? ' *' : '' }}</span>

              @switch (field.type) {
                @case ('boolean') {
                  <input
                    type="checkbox"
                    [checked]="boolValue(field.key)"
                    (change)="setValue(field.key, $any($event.target).checked)"
                  />
                }
                @case ('number') {
                  <input
                    type="number"
                    [value]="stringValue(field.key)"
                    (input)="setValue(field.key, $any($event.target).valueAsNumber)"
                  />
                }
                @case ('textarea') {
                  <textarea
                    rows="3"
                    [value]="stringValue(field.key)"
                    (input)="setValue(field.key, $any($event.target).value)"
                  ></textarea>
                }
                @case ('json') {
                  <textarea
                    class="elv-admin-form__json"
                    rows="8"
                    [value]="stringValue(field.key)"
                    (input)="setValue(field.key, $any($event.target).value)"
                  ></textarea>
                }
                @default {
                  <input
                    type="text"
                    [value]="stringValue(field.key)"
                    (input)="setValue(field.key, $any($event.target).value)"
                  />
                }
              }
            </label>
          }

          <div class="elv-admin-form__actions">
            <button type="submit" [disabled]="saving()" class="elv-admin-btn">
              {{ saving() ? 'Speichert …' : 'Speichern' }}
            </button>
            <a [routerLink]="['..']">Abbrechen</a>
          </div>
        </form>
      </div>
    }
  `,
  styles: [
    `
      .elv-admin-form {
        max-width: 480px;
      }
      .elv-admin-form__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.9rem;
        font-size: 0.85rem;
      }
      .elv-admin-form__field input[type='text'],
      .elv-admin-form__field input[type='number'],
      .elv-admin-form__field textarea {
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        font-family: inherit;
      }
      .elv-admin-form__json {
        font-family: ui-monospace, monospace;
        font-size: 0.8rem;
      }
      .elv-admin-form__actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 1rem;
      }
      .elv-admin-btn {
        background: #6366f1;
        color: #fff;
        padding: 0.5rem 1.1rem;
        border-radius: 6px;
        border: none;
        font-weight: 600;
        cursor: pointer;
      }
      .elv-admin-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .elv-admin-error {
        color: #dc2626;
      }
    `,
  ],
})
export class AdminResourceFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resources = inject(ADMIN_RESOURCES);
  private readonly api = inject(AdminApiService);

  private readonly resourceId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('resourceId') ?? '')),
    { initialValue: '' },
  );
  private readonly editId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null,
  });

  protected readonly resource = computed(() =>
    this.resources.find((r) => r.id === this.resourceId()),
  );
  protected readonly isEdit = computed(() => this.editId() !== null);

  protected readonly values = signal<Record<string, unknown>>({});
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const resource = this.resource();
      const id = this.editId();
      if (!resource) return;

      if (id) {
        this.api.list(resource).subscribe({
          next: (items) => {
            const found = items.find((item) => String(item[resource.idField]) === id);
            if (!found) {
              this.error.set(`"${id}" nicht gefunden.`);
              return;
            }
            const initial: Record<string, unknown> = {};
            for (const field of resource.fields) {
              initial[field.key] = this.rawToFormValue(field, found[field.key]);
            }
            this.values.set(initial);
          },
          error: () => this.error.set('Laden fehlgeschlagen.'),
        });
      } else {
        const initial: Record<string, unknown> = {};
        for (const field of resource.fields) {
          initial[field.key] = this.rawToFormValue(field, undefined);
        }
        this.values.set(initial);
      }
    });
  }

  protected editableFields(): AdminField[] {
    return this.resource()?.fields.filter((f) => f.editable !== false) ?? [];
  }

  protected stringValue(key: string): string {
    const value = this.values()[key];
    return value === undefined || value === null ? '' : String(value);
  }

  protected boolValue(key: string): boolean {
    return Boolean(this.values()[key]);
  }

  protected setValue(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  protected submit(): void {
    const resource = this.resource();
    if (!resource) return;

    const payload: Record<string, unknown> = {};
    for (const field of this.editableFields()) {
      try {
        payload[field.key] = this.formValueToPayloadValue(field, this.values()[field.key]);
      } catch {
        this.error.set(`Ungültiges JSON in Feld "${field.label}".`);
        return;
      }
    }

    this.saving.set(true);
    this.error.set(null);

    const id = this.editId();
    const request = id
      ? this.api.update(resource, id, payload)
      : this.api.create(resource, { ...payload, [resource.idField]: payload[resource.idField] });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/admin', resource.id]);
      },
      error: (err) => {
        this.saving.set(false);
        const message = (err?.error as { error?: { message?: string } })?.error?.message;
        this.error.set(message ?? 'Speichern fehlgeschlagen.');
      },
    });
  }

  private rawToFormValue(field: AdminField, raw: unknown): unknown {
    if (field.type === 'json') return JSON.stringify(raw ?? {}, null, 2);
    if (raw !== undefined) return raw;
    if (field.type === 'boolean') return false;
    if (field.type === 'number') return 0;
    return '';
  }

  private formValueToPayloadValue(field: AdminField, formValue: unknown): unknown {
    if (field.type === 'json') return JSON.parse(String(formValue));
    if (field.type === 'number') return Number(formValue);
    return formValue;
  }
}
