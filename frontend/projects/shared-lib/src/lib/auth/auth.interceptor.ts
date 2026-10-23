import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
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

    const authenticatedRequest = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next(authenticatedRequest).pipe(
      catchError((error: unknown) => {
        if (!matchesApi || !(error instanceof HttpErrorResponse) || error.status !== 401) {
          return throwError(() => error);
        }

        return authService.refreshAccessToken().pipe(
          switchMap((refreshedToken) => {
            if (!refreshedToken) {
              return throwError(() => error);
            }
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } }));
          }),
        );
      }),
    );
  };
}
