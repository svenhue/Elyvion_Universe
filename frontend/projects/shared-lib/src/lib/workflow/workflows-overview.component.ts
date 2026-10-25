import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { groupBySolution } from '../repository/group-by-solution';
import { SolutionsApiService } from '../solutions/solutions-api.service';
import { Solution } from '../solutions/solutions-schema';
import { WorkflowApiService, WorkflowDefinitionRecord } from './workflow-api.service';

/**
 * Landing page for "Workflows" — "bevor eine Workflow aufgemacht wird,
 * möchte ich eine Seite, wo alle Workflows aufgelistet werden, gruppiert
 * nach, in welchen Lösungen die liegen, plus alle, die im Kernrepository
 * noch nicht deployed sind." The actual builder/canvas moved to
 * `/workflows/builder/:key` (or `/workflows/builder` for a new one).
 */
@Component({
  selector: 'elv-workflows-overview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './workflows-overview.component.html',
})
export class WorkflowsOverviewComponent implements OnInit {
  private readonly workflowApi = inject(WorkflowApiService);
  private readonly solutionsApi = inject(SolutionsApiService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  private readonly latestByKey = signal<WorkflowDefinitionRecord[]>([]);
  private readonly solutions = signal<Solution[]>([]);

  readonly grouped = computed(() => groupBySolution(this.latestByKey(), (w) => w.key, 'workflow', this.solutions()));

  ngOnInit(): void {
    Promise.all([
      new Promise<WorkflowDefinitionRecord[]>((resolve) => this.workflowApi.list().subscribe({ next: resolve, error: () => resolve([]) })),
      new Promise<Solution[]>((resolve) => this.solutionsApi.list().subscribe({ next: resolve, error: () => resolve([]) })),
    ]).then(([workflows, solutions]) => {
      const latest = new Map<string, WorkflowDefinitionRecord>();
      for (const w of workflows) {
        const existing = latest.get(w.key);
        if (!existing || w.version > existing.version) latest.set(w.key, w);
      }
      this.latestByKey.set([...latest.values()]);
      this.solutions.set(solutions);
      this.loading.set(false);
    });
  }

  open(key: string): void {
    this.router.navigate(['/workflows/builder', key]);
  }

  createNew(): void {
    this.router.navigate(['/workflows/builder']);
  }
}
