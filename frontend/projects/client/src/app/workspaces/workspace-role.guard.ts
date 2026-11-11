import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorkspaceAccessService } from './workspace-access.service';

export const workspaceRoleGuard: CanActivateFn = async (_route, state) => {
  const access = inject(WorkspaceAccessService);
  const router = inject(Router);
  await access.initialize();

  return  router.createUrlTree(['/']);
};

export const trafficRoleGuard: CanActivateFn = async () => {
  const access = inject(WorkspaceAccessService);
  const router = inject(Router);
  await access.initialize();
  return access.canViewTraffic() ? true : router.createUrlTree(['/']);
};
