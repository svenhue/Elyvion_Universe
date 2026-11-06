import { InjectionToken } from '@angular/core';

export interface AdminNavigationItem {
  id: string;
  label: string;
  isVisible: () => boolean;
}

export const ADMIN_NAV_ITEMS = new InjectionToken<readonly AdminNavigationItem[]>('ADMIN_NAV_ITEMS', {
  factory: () => [],
});
