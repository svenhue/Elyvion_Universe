import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClientService } from '../api/api-client.service';
import { AuthService } from '../auth/auth.service';
import { ElvButtonComponent } from '../ui/button/button.component';
import { ElvCardComponent } from '../ui/card/card.component';

interface RegisteredUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

/**
 * Plain REST form POSTing to modules/users (`POST /api/users/register`,
 * the one Gateway route allowlisted for unauthenticated traffic) — account
 * creation is just creating a resource, not a credential grant, so unlike
 * login this can legitimately live entirely in the SPA.
 */
@Component({
  selector: 'elv-register-page',
  standalone: true,
  imports: [FormsModule, ElvButtonComponent, ElvCardComponent, RouterLink],
  template: `
    <div class="elv-auth-page">
      <elv-card title="Registrieren">
        <form (ngSubmit)="submit()">
          <label>
            E-Mail
            <input name="email" type="email" [(ngModel)]="email" required autocomplete="username" />
          </label>
          <label>
            Name (optional)
            <input name="name" type="text" [(ngModel)]="name" autocomplete="name" />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              minlength="4"
              autocomplete="new-password"
            />
          </label>

          @if (error()) {
            <p class="elv-auth-page__error">{{ error() }}</p>
          }

          <elv-button type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Wird erstellt …' : 'Konto erstellen' }}
          </elv-button>
        </form>
        <p class="elv-auth-page__hint">
          Schon registriert? <a routerLink="/login">Anmelden</a>
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
      form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.85rem;
      }
      input {
        padding: 0.5rem;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
      }
      .elv-auth-page__error {
        color: #dc2626;
        font-size: 0.85rem;
      }
      .elv-auth-page__hint {
        margin-top: 1rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ElvRegisterPageComponent {
  private readonly api = inject(ApiClientService);
  private readonly auth = inject(AuthService);

  email = '';
  name = '';
  password = '';

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (!this.email || !this.password) return;
    this.submitting.set(true);
    this.error.set(null);

    this.api.post<RegisteredUser>('users', '/register', {
      email: this.email,
      password: this.password,
      name: this.name || undefined,
    }).subscribe({
      next: () => {
        // Account created — hand off to the real OIDC login flow instead
        // of inventing a second, SPA-local sign-in mechanism.
        void this.auth.login();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const message = (err.error as { error?: { message?: string } })?.error?.message;
        this.error.set(message ?? 'Registrierung fehlgeschlagen.');
      },
    });
  }
}
