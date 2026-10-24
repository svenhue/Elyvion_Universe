import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DataAdaptersApiService } from './data-adapters-api.service';
import { ADAPTER_TYPES, AdapterType, DataAdapterConfig, DataAdapterRun } from './data-adapters-schema';

/**
 * Configure and run data adapters (SAP/REST/file/… source-system
 * connections, see data-adapters/README.md) — list, create, trigger a
 * run, schedule a cronjob, and see run history for whichever adapter is
 * selected.
 */
@Component({
  selector: 'elv-data-adapters',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './data-adapters.component.html',
})
export class DataAdaptersComponent implements OnInit {
  private readonly api = inject(DataAdaptersApiService);

  readonly adapterTypes = ADAPTER_TYPES;
  readonly adapters = signal<DataAdapterConfig[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly runs = signal<DataAdapterRun[]>([]);
  readonly loadError = signal('');
  readonly triggering = signal(false);

  readonly newName = signal('');
  readonly newType = signal<AdapterType>('http');
  readonly newConnectionConfig = signal('{\n  "url": ""\n}');
  readonly newSchedule = signal('');
  readonly creating = signal(false);
  readonly createError = signal('');

  readonly scheduleDraft = signal('');

  readonly selectedAdapter = computed(() => this.adapters().find((a) => a._id === this.selectedId()) ?? null);

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.api.list().subscribe({
      next: (adapters) => this.adapters.set(adapters),
      error: () => this.loadError.set('Daten-Adapter konnten nicht geladen werden.'),
    });
  }

  select(adapter: DataAdapterConfig): void {
    this.selectedId.set(adapter._id);
    this.scheduleDraft.set(adapter.schedule ?? '');
    this.api.listRuns(adapter._id).subscribe({ next: (runs) => this.runs.set(runs) });
  }

  async createAdapter(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    this.createError.set('');
    try {
      const connectionConfig = JSON.parse(this.newConnectionConfig() || '{}');
      const created = await firstValueFrom(
        this.api.create({
          name,
          type: this.newType(),
          connectionConfig,
          schedule: this.newSchedule().trim() || undefined,
        }),
      );
      this.newName.set('');
      this.newSchedule.set('');
      this.adapters.update((adapters) => [...adapters, created]);
      this.select(created);
    } catch (error) {
      this.createError.set(error instanceof Error ? error.message : 'Adapter konnte nicht angelegt werden.');
    } finally {
      this.creating.set(false);
    }
  }

  async removeAdapter(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id));
    this.adapters.update((adapters) => adapters.filter((a) => a._id !== id));
    if (this.selectedId() === id) {
      this.selectedId.set(null);
      this.runs.set([]);
    }
  }

  async triggerRun(): Promise<void> {
    const id = this.selectedId();
    if (!id || this.triggering()) return;
    this.triggering.set(true);
    try {
      await firstValueFrom(this.api.triggerRun(id));
      this.api.listRuns(id).subscribe({ next: (runs) => this.runs.set(runs) });
    } catch (error) {
      this.loadError.set(error instanceof Error ? error.message : 'Lauf fehlgeschlagen.');
    } finally {
      this.triggering.set(false);
    }
  }

  async saveSchedule(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    const value = this.scheduleDraft().trim();
    const updated = await firstValueFrom(this.api.schedule(id, value || null));
    this.adapters.update((adapters) => adapters.map((a) => (a._id === id ? updated : a)));
  }
}
