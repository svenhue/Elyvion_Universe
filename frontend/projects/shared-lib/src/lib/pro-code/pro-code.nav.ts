import { NavItem } from '../navigation/nav-item';

/** Zero-dependency on purpose — imported eagerly by the host app's global nav search without pulling in this feature's (lazy-loaded) component code. */
export const PRO_CODE_NAV_ITEM: NavItem = { name: 'App-Builder', url: '/pro-code' };
