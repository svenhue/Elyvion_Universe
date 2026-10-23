import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, DynamicAppSchema, DynamicAppService, DynamicRendererComponent } from '@elyvion/shared-lib';

/**
 * The entire app body is driven by the "default" DynamicAppSchema stored
 * in modules/app-config (MongoDB) — see backend/modules/app-config/scripts/seed.ts.
 * Change that document and this page's content changes without a redeploy.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DynamicRendererComponent, RouterLink],
  template: `
    <main class="home__content">
      <div class="mb-5 flex justify-end">
        <a
          routerLink="/pro-code"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-500 hover:text-indigo-700"
        >Pro-Code konfigurieren</a>
      </div>
      @if (schema(); as resolved) {
        <elv-dynamic-renderer [schema]="resolved" />
      } @else if (error()) {
        <p>{{ error() }}</p>
      } @else {
        <p>Lade Anwendung …</p>
      }
    </main>
  `,
  styles: [
    `
      .home__content {
        padding: 2rem;
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dynamicAppService = inject(DynamicAppService);

  protected readonly schema = signal<DynamicAppSchema | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const userId = (this.auth.claims()?.['sub'] as string | undefined) ?? 'anonymous';

    this.dynamicAppService
      .loadApplication({ applicationId: 'default', userId })
      .subscribe({
        next: (resolved) => this.schema.set(resolved),
        error: () => this.error.set('Anwendungs-Konfiguration konnte nicht geladen werden.'),
      });
  }
}
