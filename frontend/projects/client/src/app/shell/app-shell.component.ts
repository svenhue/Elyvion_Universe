import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AssistantWidgetComponent, FrontendActionsService } from '@elyvion/shared-lib';

/**
 * Persistent left-hand nav (Home / App-Builder / Workflows / Ontologien /
 * AI Agents / Data / Actions) wrapping every non-admin page, with a
 * router-outlet filling the rest of the viewport to its right for the
 * page itself. Lives in the client app,
 * not shared-lib — the route set it links to is this app's own, not
 * something a generic host app would share.
 *
 * Also the one component mounted on every page — the natural place to
 * register this app's frontend actions once, on boot (see
 * `FrontendActionsService.registerBuiltins()`) and to host the floating
 * assistant widget, so both are available everywhere, not just on one page.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AssistantWidgetComponent],
  template: `
    <div class="flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-900">
      <nav class="flex w-48 shrink-0 flex-col gap-1 border-r border-slate-200 bg-slate-950 p-3 text-sm">
        <a
          routerLink="/"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive="bg-slate-800"
          class="mb-3 grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-500 text-xs font-bold text-white"
        >E</a>
        <a
          routerLink="/pro-code"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >App-Builder</a>
        <a
          routerLink="/workflows"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >Workflows</a>
        <a
          routerLink="/ontologies"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >Ontologien</a>
        <a
          routerLink="/agents"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >AI Agents</a>
        <a
          routerLink="/data"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >Data</a>
        <a
          routerLink="/actions"
          routerLinkActive="bg-slate-800 text-white"
          class="rounded-md px-3 py-1.5 font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >Actions</a>
      </nav>
      <div class="min-w-0 flex-1">
        <router-outlet />
      </div>
      <elv-assistant-widget />
    </div>
  `,
})
export class AppShellComponent {
  constructor() {
    inject(FrontendActionsService).registerBuiltins();
  }
}
