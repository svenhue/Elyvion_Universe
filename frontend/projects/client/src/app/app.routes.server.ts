import { RenderMode, ServerRoute } from '@angular/ssr';

// Every route here depends on runtime auth state and live backend data
// (the application-runner module fetches the app schema per logged-in
// user) — none of it is static content that can be prerendered at build time.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Client }];
