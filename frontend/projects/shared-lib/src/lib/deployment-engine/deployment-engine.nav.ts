import { NavItem } from '../navigation/nav-item';

/**
 * Labelled "Umgebung" (environment), not "Deployments" — a
 * `DeploymentTarget` IS an environment (local, staging, a customer's
 * cloud...) and this page already lists both targets and what's
 * deployed to each, so the broader frame is the correct one, not a
 * second page duplicating the same data under a new route.
 */
export const DEPLOYMENT_ENGINE_NAV_ITEM: NavItem = { name: 'Umgebung', url: '/deployments' };
