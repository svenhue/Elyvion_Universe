import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TelemetryApiService } from './telemetry-api.service';
import { HealthTargetStatus } from './telemetry-schema';

/**
 * System-wide health overview — every backend module (auto-discovered)
 * and every running deployment, each with its latest ping result. Polls
 * like the other "live" pages in this project (AgentEngineComponent,
 * LoggingPageComponent).
 */
@Component({
  selector: 'elv-telemetry',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './telemetry.component.html',
})
export class TelemetryComponent implements OnInit, OnDestroy {
  private readonly api = inject(TelemetryApiService);

  readonly targets = signal<HealthTargetStatus[]>([]);
  readonly loadError = signal('');

  private pollHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.reload();
    this.pollHandle = setInterval(() => this.reload(), 10_000);
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  private reload(): void {
    this.api.status().subscribe({
      next: (targets) => this.targets.set(targets),
      error: () => this.loadError.set('Health-Status konnte nicht geladen werden.'),
    });
  }
}
