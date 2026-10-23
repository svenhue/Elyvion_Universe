import { Routes } from '@angular/router';
import { elvAdminRoutes, withElyvionAuthShell } from '@elyvion/shared-lib';
import { AuthCallbackComponent } from './auth-callback/auth-callback.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  // OAuth redirect landing page — must stay outside the auth guard, the
  // visitor isn't authenticated yet when they land here.
  { path: 'auth/callback', component: AuthCallbackComponent },
  ...withElyvionAuthShell([
    { path: '', component: HomeComponent },
    {
      path: 'pro-code',
      loadComponent: () => import('@elyvion/shared-lib').then((module) => module.ProCodeComponent),
    },
    {
      path: 'workflows',
      loadComponent: () => import('@elyvion/shared-lib').then((module) => module.WorkflowBuilderComponent),
    },
    { path: 'admin', children: elvAdminRoutes },
  ]),
];
