import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AppConfigApiService, AppConfigSummary } from '../application-runner/service/app-config-api.service';
import { groupBySolution } from '../repository/group-by-solution';
import { SolutionsApiService } from '../solutions/solutions-api.service';
import { Solution } from '../solutions/solutions-schema';

/**
 * Landing page for "App-Builder" — "bevor eine App aufgemacht wird,
 * möchte ich eine Seite, wo alle Apps aufgelistet werden, gruppiert nach,
 * in welchen Lösungen die liegen, plus alle, die im Kernrepository noch
 * nicht deployed sind." The actual editor moved to `/pro-code/:applicationId`.
 */
@Component({
  selector: 'elv-apps-overview',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './apps-overview.component.html',
})
export class AppsOverviewComponent implements OnInit {
  private readonly appConfigApi = inject(AppConfigApiService);
  private readonly solutionsApi = inject(SolutionsApiService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  private readonly apps = signal<AppConfigSummary[]>([]);
  private readonly solutions = signal<Solution[]>([]);

  readonly newAppId = signal('');

  readonly grouped = computed(() => groupBySolution(this.apps(), (a) => a.applicationId, 'application', this.solutions()));

  ngOnInit(): void {
    Promise.all([
      new Promise<AppConfigSummary[]>((resolve) => this.appConfigApi.list().subscribe({ next: resolve, error: () => resolve([]) })),
      new Promise<Solution[]>((resolve) => this.solutionsApi.list().subscribe({ next: resolve, error: () => resolve([]) })),
    ]).then(([apps, solutions]) => {
      this.apps.set(apps);
      this.solutions.set(solutions);
      this.loading.set(false);
    });
  }

  open(applicationId: string): void {
    this.router.navigate(['/pro-code', applicationId]);
  }

  createNew(): void {
    const id = this.newAppId().trim();
    if (!id) return;
    this.newAppId.set('');
    this.open(id);
  }
}
