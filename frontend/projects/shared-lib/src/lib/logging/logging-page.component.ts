import { DatePipe, JsonPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LoggingApiService } from './logging-api.service';
import { LogEntry, LogLevel } from './logging-schema';

/**
 * Every log entry in the environment — mostly action executions (see
 * actions-engine's `ActionsController.execute` and the frontend's
 * `FrontendActionsService.execute`, the two places that write one per
 * call), but any module can write here via `logEvent`/`log_event`.
 * Polls while auto-refresh is on, same shallow approach as the rest of
 * this project's "live" views (`AgentEngineComponent`'s run list).
 */
@Component({
  selector: 'elv-logging-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, JsonPipe],
  templateUrl: './logging-page.component.html',
})
export class LoggingPageComponent implements OnInit, OnDestroy {
  private readonly loggingApi = inject(LoggingApiService);

  readonly logs = signal<LogEntry[]>([]);
  readonly loadError = signal('');
  readonly sourceFilter = signal('');
  readonly levelFilter = signal<LogLevel | ''>('');
  readonly actionKeyFilter = signal('');
  readonly autoRefresh = signal(true);
  readonly selectedLog = signal<LogEntry | null>(null);

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.reload();
    this.pollHandle = setInterval(() => {
      if (this.autoRefresh()) this.reload();
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  applyFilters(): void {
    this.reload();
  }

  selectLog(log: LogEntry): void {
    this.selectedLog.set(log);
  }

  private reload(): void {
    this.loggingApi
      .list({
        source: this.sourceFilter().trim() || undefined,
        level: this.levelFilter() || undefined,
        actionKey: this.actionKeyFilter().trim() || undefined,
      })
      .subscribe({
        next: (logs) => this.logs.set(logs),
        error: () => this.loadError.set('Logs konnten nicht geladen werden.'),
      });
  }
}
