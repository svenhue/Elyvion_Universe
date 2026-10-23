import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AuthService,
  DynamicAppSchema,
  DynamicAppService,
  DynamicRendererComponent,
  ElvButtonComponent,
} from '@elyvion/shared-lib';

/**
 * The entire app body is driven by the "default" DynamicAppSchema stored
 * in modules/app-config (MongoDB) — see backend/modules/app-config/scripts/seed.ts.
 * Change that document and this page's content changes without a redeploy.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DynamicRendererComponent, ElvButtonComponent],
  template: `
    <header class="home__header">
      <span>Angemeldet als {{ auth.claims()?.['email'] ?? auth.claims()?.['sub'] }}</span>
      <elv-button variant="ghost" (pressed)="logout()">Abmelden</elv-button>
    </header>

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
      .home__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.85rem;
      }
      .home__content {
        padding: 2rem;
      }
    `,
  ],
})
export class HomeComponent implements OnInit {
  protected readonly auth = inject(AuthService);
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

  logout(): void {
    this.auth.logout();
  }
}
