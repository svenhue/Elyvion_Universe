import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // OAuth redirect landing page — browser-only (reads window.location, sessionStorage).
  { path: 'auth/callback', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
