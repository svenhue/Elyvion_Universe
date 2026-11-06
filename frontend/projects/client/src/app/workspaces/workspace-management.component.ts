import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkspaceAccessService } from './workspace-access.service';

@Component({
  selector: 'app-workspace-management',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="mx-auto max-w-4xl space-y-6 p-8">
      <header>
        <h1 class="text-2xl font-semibold">Arbeitsbereichverwaltung</h1>
        <p class="mt-1 text-sm text-slate-600">Verwalte den aktiven Arbeitsbereich im ausgewählten Mandanten.</p>
      </header>

      @if (access.loading()) {
        <p role="status">Lade Arbeitsbereiche …</p>
      } @else if (access.error()) {
        <p role="alert" class="rounded-md bg-red-50 p-3 text-sm text-red-800">{{ access.error() }}</p>
      } @else {
        <label class="block space-y-1 text-sm">
          <span>Mandant</span>
          <select
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            [ngModel]="access.activeTenantId()"
            (ngModelChange)="selectTenant($event)"
          >
            @for (tenant of access.tenants(); track tenant.id) {
              <option [value]="tenant.id">{{ tenant.name }}</option>
            }
          </select>
        </label>

        <section class="space-y-4 rounded-lg border border-slate-200 p-5">
          <h2 class="text-lg font-medium">Aktiver Arbeitsbereich</h2>
          @if (!access.canManageWorkspaces()) {
            <p role="status" class="text-sm text-slate-600">Für diesen Mandanten fehlen Arbeitsbereich-Berechtigungen.</p>
          }
          @if (activeWorkspace(); as workspace) {
            <label class="block space-y-1 text-sm">
              <span>Name</span>
              <input
                class="w-full rounded-md border border-slate-300 px-3 py-2"
                [ngModel]="workspaceName"
                (ngModelChange)="workspaceName = $event"
                aria-label="Name des Arbeitsbereichs"
              />
            </label>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                [disabled]="!workspaceName.trim() || busy()" (click)="saveWorkspace(workspace.id)">Speichern</button>
              @if (access.canDeleteWorkspaces()) {
                <button type="button" class="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
                  [disabled]="busy()" (click)="deleteWorkspace(workspace.id)">Arbeitsbereich löschen</button>
              }
            </div>
          } @else {
            <p class="text-sm text-slate-600">Noch kein Arbeitsbereich ausgewählt.</p>
          }

          <label class="block space-y-1 text-sm">
            <span>Arbeitsbereich auswählen</span>
            <select
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              [ngModel]="access.activeWorkspaceId()"
              (ngModelChange)="selectWorkspace($event)"
            >
              <option value="">Kein Arbeitsbereich</option>
              @for (workspace of access.workspaces(); track workspace.id) {
                <option [value]="workspace.id">{{ workspace.name }}</option>
              }
            </select>
          </label>
        </section>

        @if (canCreate()) {
          <form class="flex gap-2" (ngSubmit)="createWorkspace()">
            <label class="sr-only" for="new-workspace-name">Neuer Arbeitsbereich</label>
            <input id="new-workspace-name" class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
              name="newWorkspaceName" [(ngModel)]="newWorkspaceName" placeholder="Name des neuen Arbeitsbereichs" />
            <button type="submit" class="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              [disabled]="!newWorkspaceName.trim() || busy()">Erstellen</button>
          </form>
        }
        @if (operationError()) {
          <p role="alert" class="text-sm text-red-700">{{ operationError() }}</p>
        }
      }
    </main>
  `,
})
export class WorkspaceManagementComponent {
  protected readonly access = inject(WorkspaceAccessService);
  protected workspaceName = '';
  protected newWorkspaceName = '';
  protected readonly busy = signal(false);
  protected readonly operationError = signal<string | null>(null);

  constructor() {
    void this.access.initialize().then(() => this.syncWorkspaceName());
  }

  protected activeWorkspace() {
    return this.access.workspaces().find((workspace) => workspace.id === this.access.activeWorkspaceId());
  }

  protected canCreate(): boolean {
    return this.access.canCreateWorkspaces();
  }

  protected async selectTenant(tenantId: string): Promise<void> {
    await this.access.selectTenant(tenantId);
    this.syncWorkspaceName();
  }

  protected selectWorkspace(workspaceId: string): void {
    this.access.selectWorkspace(workspaceId);
    this.syncWorkspaceName();
  }

  protected async createWorkspace(): Promise<void> {
    await this.runOperation(async () => {
      await this.access.createWorkspace(this.newWorkspaceName.trim());
      this.newWorkspaceName = '';
      this.syncWorkspaceName();
    });
  }

  protected async saveWorkspace(id: string): Promise<void> {
    await this.runOperation(async () => {
      await this.access.updateWorkspace(id, this.workspaceName.trim());
      this.syncWorkspaceName();
    });
  }

  protected async deleteWorkspace(id: string): Promise<void> {
    if (!window.confirm('Diesen Arbeitsbereich wirklich löschen?')) return;
    await this.runOperation(() => this.access.deleteWorkspace(id));
  }

  private async runOperation(operation: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.operationError.set(null);
    try {
      await operation();
    } catch {
      this.operationError.set('Die Änderung konnte nicht gespeichert werden.');
    } finally {
      this.busy.set(false);
    }
  }

  private syncWorkspaceName(): void {
    this.workspaceName = this.activeWorkspace()?.name ?? '';
  }
}
