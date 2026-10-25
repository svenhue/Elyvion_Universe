import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  ACTIONS_NAV_ITEM,
  AGENT_ENGINE_NAV_ITEM,
  AssistantWidgetComponent,
  DATA_ADAPTERS_NAV_ITEM,
  DATA_ENGINE_NAV_ITEM,
  DEPLOYMENT_ENGINE_NAV_ITEM,
  FrontendActionsService,
  LOGGING_NAV_ITEM,
  NavigationRegistryService,
  ONTOLOGY_ENGINE_NAV_ITEM,
  PRO_CODE_NAV_ITEM,
  REPOSITORY_NAV_ITEM,
  RULES_ENGINE_NAV_ITEM,
  SOLUTIONS_NAV_ITEM,
  TELEMETRY_NAV_ITEM,
  WORKFLOW_NAV_ITEM,
} from '@elyvion/shared-lib';

/**
 * Persistent left-hand nav (Home / App-Builder / Workflows / Ontologien /
 * AI Agents / Data / Actions), a searchable global nav dropdown above it,
 * and the floating assistant widget — wrapping every non-admin page, with
 * a router-outlet filling the rest of the viewport. Lives in the client
 * app, not shared-lib — the route set it links to is this app's own, not
 * something a generic host app would share.
 *
 * Also the one component mounted on every page — the natural place to
 * register this app's frontend actions once, on boot (see
 * `FrontendActionsService.registerBuiltins()`), and to eagerly register
 * every feature's nav item (see each `*.nav.ts` — tiny, dependency-free
 * files imported here specifically so the search box can list a page
 * before its lazy-loaded route has ever been visited, without pulling
 * that page's whole component bundle into this eager one).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AssistantWidgetComponent, FormsModule],
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private readonly navigation = inject(NavigationRegistryService);

  readonly searchQuery = signal('');
  readonly searchResults = computed(() => this.navigation.search(this.searchQuery()));

  constructor() {
    inject(FrontendActionsService).registerBuiltins();
    this.navigation.registerAll([
      { name: 'Home', url: '/' },
      REPOSITORY_NAV_ITEM,
      PRO_CODE_NAV_ITEM,
      WORKFLOW_NAV_ITEM,
      ONTOLOGY_ENGINE_NAV_ITEM,
      AGENT_ENGINE_NAV_ITEM,
      DATA_ENGINE_NAV_ITEM,
      ACTIONS_NAV_ITEM,
      LOGGING_NAV_ITEM,
      DATA_ADAPTERS_NAV_ITEM,
      TELEMETRY_NAV_ITEM,
      DEPLOYMENT_ENGINE_NAV_ITEM,
      SOLUTIONS_NAV_ITEM,
      RULES_ENGINE_NAV_ITEM,
    ]);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
