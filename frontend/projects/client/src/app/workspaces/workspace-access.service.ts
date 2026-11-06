import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { ApiClientService } from '@elyvion/shared-lib';
import { firstValueFrom } from 'rxjs';

export interface TenantOption {
  id: string;
  name: string;
}

export interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthorizationDecision {
  decision: 'ALLOW' | 'DENY';
}

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  private readonly api = inject(ApiClientService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private initialization?: Promise<void>;

  readonly tenants = signal<TenantOption[]>([]);
  readonly workspaces = signal<Workspace[]>([]);
  readonly activeTenantId = signal('');
  readonly activeWorkspaceId = signal('');
  readonly canOpenPlatformConfiguration = signal(false);
  readonly canManageWorkspaces = signal(false);
  readonly canViewTraffic = signal(false);
  readonly canCreateWorkspaces = signal(false);
  readonly canUpdateWorkspaces = signal(false);
  readonly canDeleteWorkspaces = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  initialize(): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();
    this.initialization ??= this.load();
    return this.initialization;
  }

  async selectTenant(tenantId: string): Promise<void> {
    if (!this.tenants().some((tenant) => tenant.id === tenantId)) return;
    this.activeTenantId.set(tenantId);
    this.persist('elyvion.activeTenantId', tenantId);
    this.loading.set(true);
    this.error.set(null);
    this.workspaces.set([]);
    this.activeWorkspaceId.set('');
    this.canManageWorkspaces.set(false);
    this.canCreateWorkspaces.set(false);
    this.canUpdateWorkspaces.set(false);
    this.canDeleteWorkspaces.set(false);
    this.canViewTraffic.set(false);
    try {
      await this.loadTenantContext(tenantId);
    } finally {
      this.loading.set(false);
    }
  }

  selectWorkspace(workspaceId: string): void {
    if (workspaceId && !this.workspaces().some((workspace) => workspace.id === workspaceId)) return;
    this.activeWorkspaceId.set(workspaceId);
    this.persist('elyvion.activeWorkspaceId', workspaceId);
  }

  async refreshWorkspaces(): Promise<void> {
    const tenantId = this.activeTenantId();
    if (!tenantId || !this.canManageWorkspaces()) {
      this.workspaces.set([]);
      this.selectWorkspace('');
      return;
    }

    try {
      const response = await firstValueFrom(
        this.api.get<Workspace[]>('security', '/v1/workspaces', this.tenantHeaders(tenantId)),
      );
      this.workspaces.set(response.data);
      const preferredId = this.readPersisted('elyvion.activeWorkspaceId');
      const selectedId = response.data.some((workspace) => workspace.id === this.activeWorkspaceId())
        ? this.activeWorkspaceId()
        : response.data.some((workspace) => workspace.id === preferredId)
          ? preferredId ?? ''
          : '';
      this.selectWorkspace(selectedId);
      this.error.set(null);
    } catch {
      this.error.set('Arbeitsbereiche konnten nicht geladen werden.');
      this.workspaces.set([]);
      this.selectWorkspace('');
    }
  }

  async createWorkspace(name: string): Promise<void> {
    const tenantId = this.requireWorkspacePermission('workspace.create');
    const response = await firstValueFrom(
      this.api.post<Workspace>('security', '/v1/workspaces', { name }, this.tenantHeaders(tenantId)),
    );
    await this.refreshWorkspaces();
    this.selectWorkspace(response.data.id);
  }

  async updateWorkspace(id: string, name: string): Promise<void> {
    const tenantId = this.requireWorkspacePermission('workspace.update');
    const response = await firstValueFrom(
      this.api.patch<Workspace>('security', `/v1/workspaces/${encodeURIComponent(id)}`, { name }, this.tenantHeaders(tenantId)),
    );
    this.workspaces.update((items) => items.map((item) => item.id === id ? response.data : item));
  }

  async deleteWorkspace(id: string): Promise<void> {
    const tenantId = this.requireWorkspacePermission('workspace.delete');
    await firstValueFrom(
      this.api.delete('security', `/v1/workspaces/${encodeURIComponent(id)}`, this.tenantHeaders(tenantId)),
    );
    if (this.activeWorkspaceId() === id) this.selectWorkspace('');
    await this.refreshWorkspaces();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.api.get<TenantOption[]>('security', '/tenants/mine'));
      this.tenants.set(response.data);
      if (!response.data.length) {
        this.error.set('Für diesen Benutzer ist kein aktiver Mandant verfügbar.');
        return;
      }

      const tenantAccess = await Promise.all(response.data.map(async (tenant) => ({
        tenant,
        platform: await this.isAllowed(tenant.id, 'platform-configuration', 'platform.configuration.read'),
        workspaceRead: await this.isAllowed(tenant.id, 'workspace-management', 'workspace.read'),
        workspaceCreate: await this.isAllowed(tenant.id, 'workspace-management', 'workspace.create'),
        workspaceUpdate: await this.isAllowed(tenant.id, 'workspace-management', 'workspace.update'),
        workspaceDelete: await this.isAllowed(tenant.id, 'workspace-management', 'workspace.delete'),
        trafficRead: await this.isAllowed(tenant.id, 'observability-traffic', 'observability.traffic.read'),
      })));

      const storedTenantId = this.readPersisted('elyvion.activeTenantId');
      const preferredTenant = tenantAccess.find((entry) => entry.tenant.id === storedTenantId &&
        (entry.platform || entry.workspaceRead));
      const tenant = preferredTenant?.tenant ??
        tenantAccess.find((entry) => entry.workspaceRead)?.tenant ??
        tenantAccess.find((entry) => entry.platform)?.tenant ??
        tenantAccess[0].tenant;
      const access = tenantAccess.find((entry) => entry.tenant.id === tenant.id)!;

      this.activeTenantId.set(tenant.id);
      this.canOpenPlatformConfiguration.set(tenantAccess.some((entry) => entry.platform));
      this.persist('elyvion.activeTenantId', tenant.id);
      await this.loadTenantContext(tenant.id, access);
    } catch {
      this.error.set('Berechtigungen oder Arbeitsbereichsdaten konnten nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTenantContext(
    tenantId: string,
    knownAccess?: {
      platform: boolean;
      workspaceRead: boolean;
      workspaceCreate: boolean;
      workspaceUpdate: boolean;
      workspaceDelete: boolean;
      trafficRead: boolean;
    },
  ): Promise<void> {
    const access = knownAccess ?? {
      platform: await this.isAllowed(tenantId, 'platform-configuration', 'platform.configuration.read'),
      workspaceRead: await this.isAllowed(tenantId, 'workspace-management', 'workspace.read'),
      workspaceCreate: await this.isAllowed(tenantId, 'workspace-management', 'workspace.create'),
      workspaceUpdate: await this.isAllowed(tenantId, 'workspace-management', 'workspace.update'),
      workspaceDelete: await this.isAllowed(tenantId, 'workspace-management', 'workspace.delete'),
      trafficRead: await this.isAllowed(tenantId, 'observability-traffic', 'observability.traffic.read'),
    };
    this.canOpenPlatformConfiguration.set(access.platform);
    this.canManageWorkspaces.set(access.workspaceRead);
    this.canCreateWorkspaces.set(access.workspaceCreate);
    this.canUpdateWorkspaces.set(access.workspaceUpdate);
    this.canDeleteWorkspaces.set(access.workspaceDelete);
    this.canViewTraffic.set(access.trafficRead);
    if (this.tenants().some((tenant) => tenant.id !== tenantId)) {
      const hasPlatformAccess = await Promise.all(this.tenants()
        .filter((tenant) => tenant.id !== tenantId)
        .map((tenant) => this.isAllowed(tenant.id, 'platform-configuration', 'platform.configuration.read')));
      this.canOpenPlatformConfiguration.set(access.platform || hasPlatformAccess.some(Boolean));
    }
    await this.refreshWorkspaces();
  }

  private async isAllowed(tenantId: string, resourceType: string, action: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.api.post<AuthorizationDecision>(
          'security',
          '/v1/authorize',
          { action, resource: { type: resourceType, attributes: { tenantId } }, context: {} },
          this.tenantHeaders(tenantId),
        ),
      );
      return response.data.decision === 'ALLOW';
    } catch {
      return false;
    }
  }

  private requireWorkspacePermission(action: string): string {
    const tenantId = this.activeTenantId();
    if (!tenantId || !this.isPermissionAvailable(action)) {
      throw new Error('You are not authorized to manage workspaces in the active tenant.');
    }
    return tenantId;
  }

  private isPermissionAvailable(action: string): boolean {
    if (action === 'workspace.create') return this.canCreateWorkspaces();
    if (action === 'workspace.update') return this.canUpdateWorkspaces();
    if (action === 'workspace.delete') return this.canDeleteWorkspaces();
    return this.canManageWorkspaces();
  }

  private tenantHeaders(tenantId: string): Record<string, string> {
    return { 'x-tenant-id': tenantId };
  }

  private readPersisted(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }

  private persist(key: string, value: string): void {
    if (this.isBrowser && value) localStorage.setItem(key, value);
    else if (this.isBrowser) localStorage.removeItem(key);
  }
}
