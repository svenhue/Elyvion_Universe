import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ADMIN_RESOURCES } from './admin-resource';

/**
 * Sidebar of every configured resource (one per DB table/collection) +
 * router-outlet for the list/form. Registered via provideAdminResources()
 * in the host app — this component has no idea what the actual tables are.
 */
@Component({
  selector: 'elv-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="elv-admin">
      <nav class="elv-admin__nav">
        <h1>Admin</h1>
        @for (resource of resources; track resource.id) {
          <a [routerLink]="[resource.id]" routerLinkActive="elv-admin__nav-link--active">
            {{ resource.label }}
          </a>
        }
      </nav>
      <main class="elv-admin__content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      .elv-admin {
        display: flex;
        min-height: 100vh;
        font-family: -apple-system, system-ui, sans-serif;
      }
      .elv-admin__nav {
        width: 220px;
        flex-shrink: 0;
        border-right: 1px solid #e2e8f0;
        padding: 1.25rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .elv-admin__nav h1 {
        font-size: 1rem;
        margin: 0 0 1rem;
      }
      .elv-admin__nav a {
        padding: 0.4rem 0.6rem;
        border-radius: 6px;
        color: inherit;
        text-decoration: none;
        font-size: 0.9rem;
      }
      .elv-admin__nav a:hover {
        background: #f1f5f9;
      }
      .elv-admin__nav-link--active {
        background: #e0e7ff;
        font-weight: 600;
      }
      .elv-admin__content {
        flex: 1;
        padding: 1.5rem 2rem;
        overflow-x: auto;
      }
    `,
  ],
})
export class AdminShellComponent {
  protected readonly resources = inject(ADMIN_RESOURCES);
}
