import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { OBSERVABILITY_TENANT_ID } from './observability-tenant.token';
import { TrafficEvent, TrafficEventsApiService } from './traffic-events-api.service';

@Component({
  selector: 'elv-traffic-events',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <section aria-labelledby="traffic-title">
      <header class="traffic-header">
        <div>
          <a routerLink="/platform-configuration">← Plattformkonfiguration</a>
          <h1 id="traffic-title">HTTP-Traffic</h1>
          <p>Erfasste HTTP-Metadaten der instrumentierten Services (30 Tage Aufbewahrung).</p>
        </div>
        <button type="button" (click)="reload()" [disabled]="loading()">Aktualisieren</button>
      </header>

      @if (loading()) {
        <p role="status">Traffic-Ereignisse werden geladen …</p>
      } @else if (error()) {
        <p role="alert">{{ error() }}</p>
      } @else if (!events().length) {
        <p role="status">Keine Traffic-Ereignisse vorhanden.</p>
      } @else {
        <div class="table-wrap">
          <table>
            <caption>HTTP-Ereignisse, neueste zuerst</caption>
            <thead>
              <tr>
                <th scope="col">Zeit</th>
                <th scope="col">Richtung</th>
                <th scope="col">Quelle → Ziel</th>
                <th scope="col">Request</th>
                <th scope="col">Status</th>
                <th scope="col">Dauer</th>
                <th scope="col">Fehlerdetails</th>
              </tr>
            </thead>
            <tbody>
              @for (event of events(); track event.id) {
                <tr>
                  <td>{{ event.observedAt | date: 'medium' }}</td>
                  <td>{{ event.direction }}</td>
                  <td>{{ event.sourceService }} → {{ event.targetService }}</td>
                  <td><code>{{ event.method }} {{ event.path }}</code></td>
                  <td>{{ event.statusCode ?? '—' }}</td>
                  <td>{{ event.durationMs === null ? '—' : event.durationMs + ' ms' }}</td>
                  <td>
                    @if (event.errorCode) {
                      <span>{{ event.errorCode }}{{ event.errorDetail ? ': ' + event.errorDetail : '' }}</span>
                    } @else {
                      —
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="pagination" aria-label="Traffic-Seiten">
          <button type="button" (click)="previous()" [disabled]="offset() === 0 || loading()">Zurück</button>
          <span>Seite {{ offset() / pageSize + 1 }}</span>
          <button type="button" (click)="next()" [disabled]="events().length < pageSize || loading()">Weiter</button>
        </nav>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .traffic-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .table-wrap { overflow-x: auto; margin-top: 1.25rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    caption { text-align: left; padding: 0.5rem 0; }
    th, td { padding: 0.65rem; border-bottom: 1px solid var(--elv-border-color, currentColor); vertical-align: top; }
    code { overflow-wrap: anywhere; }
    .pagination { display: flex; align-items: center; gap: 1rem; justify-content: flex-end; margin-top: 1rem; }
    a:focus-visible, button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    @media (max-width: 700px) { .traffic-header { flex-direction: column; } }
  `],
})
export class TrafficEventsComponent implements OnInit {
  private readonly api = inject(TrafficEventsApiService);
  private readonly tenantId = inject(OBSERVABILITY_TENANT_ID);
  readonly events = signal<TrafficEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly offset = signal(0);
  readonly pageSize = 50;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    const tenantId = this.tenantId();
    if (!tenantId) {
      this.events.set([]);
      this.error.set('Kein administrativer Mandant ausgewählt.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.api.list(tenantId, this.offset()).pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (response) => this.events.set(response.data),
      error: () => {
        this.events.set([]);
        this.error.set('Traffic-Ereignisse konnten nicht geladen werden.');
      },
    });
  }

  previous(): void {
    this.offset.update((value) => Math.max(0, value - this.pageSize));
    this.reload();
  }

  next(): void {
    this.offset.update((value) => value + this.pageSize);
    this.reload();
  }
}
