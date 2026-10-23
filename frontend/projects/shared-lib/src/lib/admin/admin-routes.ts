import { Routes } from '@angular/router';
import { AdminResourceFormComponent } from './admin-resource-form.component';
import { AdminResourceListComponent } from './admin-resource-list.component';
import { AdminShellComponent } from './admin-shell.component';

/**
 * Spread under whatever path/guard the host app wants, e.g.:
 * { path: 'admin', canActivate: [elyvionAuthGuard], children: elvAdminRoutes }
 * Needs provideAdminResources() in the same injector for ADMIN_RESOURCES to resolve.
 */
export const elvAdminRoutes: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: ':resourceId/new', component: AdminResourceFormComponent },
      { path: ':resourceId/:id/edit', component: AdminResourceFormComponent },
      { path: ':resourceId', component: AdminResourceListComponent },
    ],
  },
];
