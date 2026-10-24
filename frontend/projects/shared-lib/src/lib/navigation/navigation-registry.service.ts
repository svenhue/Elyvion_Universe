import { Injectable, signal } from '@angular/core';
import { NavItem } from './nav-item';

export interface FlatNavItem {
  name: string;
  url: string;
  /** Dotted path of parent names, e.g. "Workflows" for a hypothetical sub-item — empty for a top-level item. */
  path: string;
}

/**
 * Where every client module's nav items end up — the frontend counterpart
 * to actions-engine's action registry and agent-engine's prompts registry,
 * same self-registration spirit: a module (here, the host app's
 * `AppShellComponent`, since *which* pages exist is host-app-specific)
 * registers its own `NavItem`s rather than the search UI hardcoding them.
 */
@Injectable({ providedIn: 'root' })
export class NavigationRegistryService {
  private readonly items = signal<NavItem[]>([]);

  register(item: NavItem): void {
    this.items.update((items) => [...items.filter((existing) => existing.url !== item.url), item]);
  }

  registerAll(items: NavItem[]): void {
    for (const item of items) this.register(item);
  }

  /** Every item flattened (children included), name-prefix-matched against `query`, case-insensitive. Empty `query` returns nothing — the dropdown only appears once the user starts typing. */
  search(query: string): FlatNavItem[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return flatten(this.items()).filter((item) => item.name.toLowerCase().startsWith(needle));
  }
}

function flatten(items: NavItem[], path = ''): FlatNavItem[] {
  const result: FlatNavItem[] = [];
  for (const item of items) {
    result.push({ name: item.name, url: item.url, path });
    if (item.children?.length) {
      result.push(...flatten(item.children, path ? `${path} / ${item.name}` : item.name));
    }
  }
  return result;
}
