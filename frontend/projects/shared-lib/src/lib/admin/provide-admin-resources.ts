import { Provider } from '@angular/core';
import { ADMIN_RESOURCES, AdminResourceConfig } from './admin-resource';

export function provideAdminResources(resources: AdminResourceConfig[]): Provider {
  return { provide: ADMIN_RESOURCES, useValue: resources };
}
