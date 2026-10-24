import { Routes } from '@angular/router';
import { elvAdminRoutes, withElyvionAuthShell } from '@elyvion/shared-lib';
import { AuthCallbackComponent } from './auth-callback/auth-callback.component';
import { HomeComponent } from './home/home.component';
import { AppShellComponent } from './shell/app-shell.component';

export const routes: Routes = [
  // OAuth redirect landing page — must stay outside the auth guard, the
  // visitor isn't authenticated yet when they land here.
  { path: 'auth/callback', component: AuthCallbackComponent },
  ...withElyvionAuthShell([
    {
      path: '',
      component: AppShellComponent,
      children: [
        { path: '', component: HomeComponent },
        {
          path: 'pro-code',
          loadComponent: () => import('@elyvion/shared-lib').then((module) => module.ProCodeComponent),
        },
        {
          path: 'workflows',
          loadComponent: () => import('@elyvion/shared-lib').then((module) => module.WorkflowBuilderComponent),
        },
        {
          path: 'ontologies',
          loadComponent: () => import('@elyvion/shared-lib').then((module) => module.OntologyEngineComponent),
        },
        {
          path: 'agents',
          loadComponent: () => import('@elyvion/shared-lib').then((module) => module.AgentEngineComponent),
        },
        {
          path: 'data',
          loadComponent: () => import('@elyvion/shared-lib').then((module) => module.DataEngineComponent),
        },
      ],
    },
    { path: 'admin', children: elvAdminRoutes },
  ]),
];
