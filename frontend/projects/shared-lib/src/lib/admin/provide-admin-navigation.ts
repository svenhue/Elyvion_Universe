import { Provider } from '@angular/core';
import { ADMIN_NAV_ITEMS, AdminNavigationItem } from './admin-navigation';

export function provideAdminNavigation(items: readonly AdminNavigationItem[]): Provider {
  return { provide: ADMIN_NAV_ITEMS, useValue: items };
}
