import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PlatformEnvironmentApiService } from './platform-environment-api.service';

/**
 * Admin settings page for the platform-environment "observer" (see
 * `ontology-engine`'s `app/environment` submodule): turns on/off whether
 * the running Elyvion platform itself — every registered backend module,
 * every known frontend app — gets continuously mirrored into its own
 * ontology (type `"elyvion_platform_environment"`). Off by default;
 * nothing talks to the Registry on the environment's behalf until an
 * admin opts in here.
 */
@Component({
  selector: 'elv-platform-environment-settings',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-xl space-y-6 p-2">
      <div>
        <h1 class="text-lg font-semibold text-slate-900">Platform-Umgebung</h1>
        <p class="mt-1 text-sm text-slate-500">
          Bildet die laufende Elyvion-Plattform (alle Backend- und Frontend-Server) als Ontologie ab —
          Ontologie-Typ <code class="rounded bg-slate-100 px-1 py-0.5 text-xs">elyvion_platform_environment</code>.
        </p>
      </div>

      <div class="flex items-center justify-between rounded-xl border border-slate-200 p-4">
        <div>
          <p class="text-sm font-medium text-slate-800">Automatische Synchronisierung</p>
          <p class="mt-0.5 text-xs text-slate-500">
            Läuft alle 30 Sekunden im Hintergrund, solange aktiv.
          </p>
        </div>
        <button
          type="button"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
          [class.bg-indigo-600]="enabled()"
          [class.bg-slate-300]="!enabled()"
          [disabled]="loading()"
          (click)="toggle()"
        >
          <span
            class="inline-block size-4 translate-x-1 rounded-full bg-white transition-transform"
            [class.translate-x-6]="enabled()"
          ></span>
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          [disabled]="syncing()"
          (click)="syncNow()"
        >
          {{ syncing() ? 'Synchronisiert …' : 'Jetzt synchronisieren' }}
        </button>
        <a routerLink="/ontologies" class="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          In der Ontologien-Ansicht öffnen →
        </a>
      </div>

      @if (lastSync(); as result) {
        <p class="text-xs text-slate-500">
          Letzte Synchronisierung: {{ result.nodes }} Nodes, {{ result.edges }} Beziehungen.
        </p>
      }
      @if (error()) {
        <p class="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{{ error() }}</p>
      }
    </div>
  `,
})
export class PlatformEnvironmentSettingsComponent implements OnInit {
  private readonly api = inject(PlatformEnvironmentApiService);

  readonly enabled = signal(false);
  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly error = signal('');
  readonly lastSync = signal<{ nodes: number; edges: number } | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const settings = await firstValueFrom(this.api.getSettings());
      this.enabled.set(settings.enabled);
    } catch (error) {
      this.error.set(errorMessage(error, 'Einstellungen konnten nicht geladen werden.'));
    }
  }

  async toggle(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const next = !this.enabled();
      const saved = await firstValueFrom(this.api.setSettings(next));
      this.enabled.set(saved.enabled);
    } catch (error) {
      this.error.set(errorMessage(error, 'Einstellung konnte nicht gespeichert werden.'));
    } finally {
      this.loading.set(false);
    }
  }

  async syncNow(): Promise<void> {
    this.syncing.set(true);
    this.error.set('');
    try {
      this.lastSync.set(await firstValueFrom(this.api.triggerSync()));
    } catch (error) {
      this.error.set(errorMessage(error, 'Synchronisierung fehlgeschlagen.'));
    } finally {
      this.syncing.set(false);
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return `${fallback} ${error.message}`;
  return fallback;
}
