import { Routes } from '@angular/router';
import { elyvionAuthGuard } from './auth.guard';
import { ElvLoginPageComponent } from './login-page.component';
import { ElvRegisterPageComponent } from './register-page.component';

/** `/login` and `/register`, unguarded — import directly if you want full control over route placement. */
export const elyvionAuthRoutes: Routes = [
  { path: 'login', component: ElvLoginPageComponent },
  { path: 'register', component: ElvRegisterPageComponent },
];

/**
 * Wraps a host app's own routes with everything the auth module needs:
 * `/login` + `/register`, the rest of `appRoutes` behind `elyvionAuthGuard`
 * (redirecting to `/login` when unauthenticated), and a catch-all back to
 * the app root. One call sets up the whole shell:
 *
 * export const routes = withElyvionAuthShell(myAppRoutes);
 */
export function withElyvionAuthShell(appRoutes: Routes): Routes {
  return [
    ...elyvionAuthRoutes,
    { path: '', canActivate: [elyvionAuthGuard], children: appRoutes },
    { path: '**', redirectTo: '' },
  ];
}
