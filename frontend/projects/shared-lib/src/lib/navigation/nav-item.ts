/** One entry a client module exposes to the global nav search — just enough to show and route to it, never the module's component code itself (kept in a tiny, dependency-free file per feature specifically so the global nav can list every page without eagerly loading any of their lazy-loaded bundles). */
export interface NavItem {
  name: string;
  url: string;
  children?: NavItem[];
}
