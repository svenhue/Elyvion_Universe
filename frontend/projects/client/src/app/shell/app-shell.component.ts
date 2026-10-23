import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Persistent top nav (Home / App-Builder / Workflows / Ontologien) wrapping
 * every non-admin page, with a router-outlet below it for the page itself.
 * Lives in the client app, not shared-lib — the route set it links to is
 * this app's own, not something a generic host app would share.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-white font-sans text-slate-900">
      <nav class="flex h-12 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-950 px-3 text-sm">
        <a
          routerLink="/"
          [routerLinkActiveOptions]="{ exact: true }"
          routerLinkActive="bg-slate-800"
          class="mr-3 grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-500 text-xs font-bold text-white"
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
      </nav>
      <div class="min-h-0 flex-1">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AppShellComponent {}
