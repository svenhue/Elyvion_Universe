import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DataEngineApiService } from './data-engine-api.service';
import { DataRecord, EntityDefinition, FieldType } from './data-engine-schema';

interface NewFieldDraft {
  name: string;
  type: FieldType;
  required: boolean;
}

/** A record's field value mid-edit — always a string in the form, coerced to the field's real type on submit, same loose-then-coerce pattern the rest of this project's dynamic forms (workflow steps, actions) use. */
interface RecordFieldDraft {
  name: string;
  type: FieldType;
  value: string;
}

/**
 * Manages `data-engine` entities (define/delete) and, for whichever
 * entity is selected, its records — a thin, generic admin UI over the
 * generic CRUD `data-engine` exposes for *any* entity, so this page never
 * needs updating when a new entity is defined.
 */
@Component({
  selector: 'elv-data-engine',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './data-engine.component.html',
})
export class DataEngineComponent implements OnInit {
  private readonly dataApi = inject(DataEngineApiService);

  readonly entities = signal<EntityDefinition[]>([]);
  readonly selectedEntityName = signal<string | null>(null);
  readonly records = signal<DataRecord[]>([]);
  readonly loadError = signal('');

  readonly newEntityName = signal('');
  readonly newFields = signal<NewFieldDraft[]>([{ name: '', type: 'string', required: false }]);
  readonly creatingEntity = signal(false);

  readonly recordForm = signal<RecordFieldDraft[] | null>(null);
  readonly editingRecordId = signal<string | null>(null);
  readonly savingRecord = signal(false);

  readonly selectedEntity = computed(
    () => this.entities().find((entity) => entity.name === this.selectedEntityName()) ?? null,
  );

  ngOnInit(): void {
    this.loadEntities();
  }

  private loadEntities(): void {
    this.dataApi.listEntities().subscribe({
      next: (entities) => this.entities.set(entities),
      error: () => this.loadError.set('Entitäten konnten nicht geladen werden.'),
    });
  }

  selectEntity(entity: EntityDefinition): void {
    this.selectedEntityName.set(entity.name);
    this.recordForm.set(null);
    this.editingRecordId.set(null);
    this.loadRecords(entity.name);
  }

  private loadRecords(entityName: string): void {
    this.dataApi.listRecords(entityName).subscribe({
      next: (records) => this.records.set(records),
      error: () => this.loadError.set('Datensätze konnten nicht geladen werden.'),
    });
  }

  // --- Entity definition ---

  addFieldRow(): void {
    this.newFields.update((fields) => [...fields, { name: '', type: 'string', required: false }]);
  }

  removeFieldRow(index: number): void {
    this.newFields.update((fields) => fields.filter((_, i) => i !== index));
  }

  updateFieldRow(index: number, patch: Partial<NewFieldDraft>): void {
    this.newFields.update((fields) => fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  async createEntity(): Promise<void> {
    const name = this.newEntityName().trim();
    const fields = this.newFields().filter((field) => field.name.trim());
    if (!name || !fields.length || this.creatingEntity()) return;
    this.creatingEntity.set(true);
    this.loadError.set('');
    try {
      const created = await firstValueFrom(
        this.dataApi.createEntity({ name, fields: fields.map((field) => ({ ...field, name: field.name.trim() })) }),
      );
      this.newEntityName.set('');
      this.newFields.set([{ name: '', type: 'string', required: false }]);
      this.entities.update((entities) => [...entities, created]);
      this.selectEntity(created);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Entität konnte nicht angelegt werden.'));
    } finally {
      this.creatingEntity.set(false);
    }
  }

  async removeEntity(name: string): Promise<void> {
    await firstValueFrom(this.dataApi.deleteEntity(name));
    this.entities.update((entities) => entities.filter((entity) => entity.name !== name));
    if (this.selectedEntityName() === name) {
      this.selectedEntityName.set(null);
      this.records.set([]);
    }
  }

  // --- Records ---

  openNewRecordForm(): void {
    const entity = this.selectedEntity();
    if (!entity) return;
    this.editingRecordId.set(null);
    this.recordForm.set(entity.fields.map((field) => ({ name: field.name, type: field.type, value: '' })));
  }

  openEditRecordForm(record: DataRecord): void {
    const entity = this.selectedEntity();
    if (!entity) return;
    this.editingRecordId.set(record.id);
    this.recordForm.set(
      entity.fields.map((field) => ({ name: field.name, type: field.type, value: stringify(record[field.name]) })),
    );
  }

  closeRecordForm(): void {
    this.recordForm.set(null);
    this.editingRecordId.set(null);
  }

  updateRecordField(name: string, value: string): void {
    this.recordForm.update((fields) => fields?.map((field) => (field.name === name ? { ...field, value } : field)) ?? null);
  }

  async saveRecord(): Promise<void> {
    const entity = this.selectedEntity();
    const form = this.recordForm();
    if (!entity || !form || this.savingRecord()) return;
    this.savingRecord.set(true);
    this.loadError.set('');
    try {
      const input: Record<string, unknown> = {};
      for (const field of form) {
        if (field.value === '') continue;
        input[field.name] = coerceField(field);
      }
      const editingId = this.editingRecordId();
      if (editingId) {
        await firstValueFrom(this.dataApi.updateRecord(entity.name, editingId, input));
      } else {
        await firstValueFrom(this.dataApi.createRecord(entity.name, input));
      }
      this.closeRecordForm();
      this.loadRecords(entity.name);
    } catch (error) {
      this.loadError.set(errorMessage(error, 'Datensatz konnte nicht gespeichert werden.'));
    } finally {
      this.savingRecord.set(false);
    }
  }

  async removeRecord(id: string): Promise<void> {
    const entity = this.selectedEntity();
    if (!entity) return;
    await firstValueFrom(this.dataApi.deleteRecord(entity.name, id));
    this.records.update((records) => records.filter((record) => record.id !== id));
  }
}

function coerceField(field: RecordFieldDraft): unknown {
  if (field.type === 'number') return Number(field.value);
  if (field.type === 'boolean') return field.value === 'true';
  return field.value;
}

function stringify(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
