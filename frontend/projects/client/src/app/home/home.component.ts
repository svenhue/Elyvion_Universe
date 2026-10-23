import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService, DynamicAppSchema, DynamicAppService, DynamicRendererComponent } from '@elyvion/shared-lib';

/**
 * The entire app body is driven by the "default" DynamicAppSchema stored
 * in modules/app-config (MongoDB) — see backend/modules/app-config/scripts/seed.ts.
 * Change that document and this page's content changes without a redeploy.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DynamicRendererComponent],
  template: `
    <main class="home__content">
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
