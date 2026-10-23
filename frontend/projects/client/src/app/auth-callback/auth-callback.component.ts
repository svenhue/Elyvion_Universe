import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@elyvion/shared-lib';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<p>Signing you in…</p>`,
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.handleCallback(new URLSearchParams(window.location.search));
    } finally {
      await this.router.navigateByUrl('/');
    }
  }
}
