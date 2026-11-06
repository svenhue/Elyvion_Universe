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

  readonly tenantId = signal('');
  readonly workspaceId = signal('');
  readonly environmentId = signal('');
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
    if (!this.hasScope()) {
      this.adapters.set([]);
      return;
    }
    this.api.list(this.scope()).subscribe({
      next: (adapters) => this.adapters.set(adapters),
      error: () => this.loadError.set('Daten-Adapter konnten nicht geladen werden.'),
    });
  }

  select(adapter: DataAdapterConfig): void {
    this.selectedId.set(adapter._id);
    this.scheduleDraft.set(adapter.schedule ?? '');
    this.api.listRuns(adapter._id, this.scope()).subscribe({ next: (runs) => this.runs.set(runs) });
  }

  async createAdapter(event: Event): Promise<void> {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const name = this.newName().trim();
    if (!name || this.creating()) return;
    if (!this.hasScope()) {
      this.createError.set('Tenant, Workspace und Umgebung müssen angegeben werden.');
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    try {
      const connectionConfig = JSON.parse(this.newConnectionConfig() || '{}');
      const formData = new FormData(form);
      const secretValue = formData.get('secretValue');
      const secretName = formData.get('secretName');
      const configKey = formData.get('configKey');
      const secretType = formData.get('secretType');
      const secrets =
        typeof secretValue === 'string' && secretValue
          ? [{
              name: typeof secretName === 'string' && secretName ? secretName : 'Adapter credential',
              type: typeof secretType === 'string' ? secretType as 'password' | 'api_key' | 'token' | 'private_key' | 'oauth_client_secret' : 'api_key',
              configKey: typeof configKey === 'string' && configKey ? configKey : 'headers.authorization',
              value: secretValue,
            }]
          : [];
      const created = await firstValueFrom(
        this.api.create({
          name,
          type: this.newType(),
          connectionConfig,
          secrets,
          schedule: this.newSchedule().trim() || undefined,
        }, this.scope()),
      );
      this.newName.set('');
      this.newSchedule.set('');
      this.adapters.update((adapters) => [...adapters, created]);
      this.select(created);
    } catch (error) {
      this.createError.set('Adapter konnte nicht sicher angelegt werden. Prüfe Konfiguration und Berechtigungen.');
    } finally {
      const secretInput = form.querySelector<HTMLInputElement>('[name="secretValue"]');
      if (secretInput) secretInput.value = '';
      this.creating.set(false);
    }
  }

  async removeAdapter(id: string): Promise<void> {
    await firstValueFrom(this.api.remove(id, this.scope()));
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
      await firstValueFrom(this.api.triggerRun(id, this.scope()));
      this.api.listRuns(id, this.scope()).subscribe({ next: (runs) => this.runs.set(runs) });
    } catch (error) {
      this.loadError.set('Adapter-Test fehlgeschlagen oder wurde nicht autorisiert.');
    } finally {
      this.triggering.set(false);
    }
  }

  async saveSchedule(): Promise<void> {
    const id = this.selectedId();
    if (!id) return;
    const value = this.scheduleDraft().trim();
    const updated = await firstValueFrom(this.api.schedule(id, value || null, this.scope()));
    this.adapters.update((adapters) => adapters.map((a) => (a._id === id ? updated : a)));
  }

  scopeChanged(): void {
    this.selectedId.set(null);
    this.runs.set([]);
    this.reload();
  }

  private hasScope(): boolean {
    return !!this.tenantId().trim() && !!this.workspaceId().trim() && !!this.environmentId().trim();
  }

  private scope() {
    return {
      tenantId: this.tenantId().trim(),
      workspaceId: this.workspaceId().trim(),
      environmentId: this.environmentId().trim(),
    };
  }
}
