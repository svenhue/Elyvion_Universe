import { Routes } from '@angular/router';
import { PlatformEnvironmentSettingsComponent } from '../ontology-engine/platform-environment-settings.component';
import { AdminResourceFormComponent } from './admin-resource-form.component';
import { AdminResourceListComponent } from './admin-resource-list.component';
import { AdminShellComponent } from './admin-shell.component';

/**
 * Spread under whatever path/guard the host app wants, e.g.:
 * { path: 'admin', canActivate: [elyvionAuthGuard], children: elvAdminRoutes }
 * Needs provideAdminResources() in the same injector for ADMIN_RESOURCES to resolve.
 *
 * `platform-environment` is listed before the dynamic `:resourceId` routes
 * on purpose — as a param route, `:resourceId` would otherwise swallow it.
 */
export const elvAdminRoutes: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: 'platform-environment', component: PlatformEnvironmentSettingsComponent },
      { path: ':resourceId/new', component: AdminResourceFormComponent },
      { path: ':resourceId/:id/edit', component: AdminResourceFormComponent },
      { path: ':resourceId', component: AdminResourceListComponent },
    ],
  },
];
