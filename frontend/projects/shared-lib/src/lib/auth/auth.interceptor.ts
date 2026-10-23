import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Attaches the access token to every outgoing request whose URL starts
 * with one of `apiBaseUrls` (typically just the Gateway's base URL) —
 * never to third-party requests.
 */
export function createAuthInterceptor(apiBaseUrls: string[]): HttpInterceptorFn {
  return (req, next) => {
    const authService = inject(AuthService);
    const matchesApi = apiBaseUrls.some((base) => req.url.startsWith(base));
    const token = matchesApi ? authService.getAccessToken() : null;

    if (!token) return next(req);

    return next(
      req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      }),
    );
  };
}
