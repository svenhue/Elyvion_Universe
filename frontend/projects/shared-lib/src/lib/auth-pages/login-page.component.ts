import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ElvButtonComponent } from '../ui/button/button.component';
import { ElvCardComponent } from '../ui/card/card.component';

/**
 * Doesn't collect a password itself — it starts the OAuth 2.1 + PKCE
 * Authorization Code flow against the Auth module (modules/auth), which
 * renders its own hosted login form and verifies credentials against
 * modules/users. Embedding a password field here instead would mean this
 * SPA handling raw credentials directly (the Resource Owner Password
 * grant) — exactly what the redirect-based flow avoids.
 */
@Component({
  selector: 'elv-login-page',
  standalone: true,
  imports: [ElvButtonComponent, ElvCardComponent, RouterLink],
  template: `
    <div class="elv-auth-page">
      <elv-card title="Anmelden">
        <p>Melde dich an, um fortzufahren.</p>
        <elv-button (pressed)="login()">Mit Elyvion anmelden</elv-button>
        <p class="elv-auth-page__hint">
          Noch kein Konto? <a routerLink="/register">Registrieren</a>
        </p>
      </elv-card>
    </div>
  `,
  styles: [
    `
      .elv-auth-page {
        max-width: 360px;
        margin: 10vh auto;
        padding: 0 1rem;
      }
      .elv-auth-page__hint {
        margin-top: 1rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ElvLoginPageComponent {
  private readonly auth = inject(AuthService);

  login(): void {
    void this.auth.login();
  }
}
