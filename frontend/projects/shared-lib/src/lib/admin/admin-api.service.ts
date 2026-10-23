import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { AdminResourceConfig } from './admin-resource';

/**
 * Drives CRUD HTTP calls purely from an AdminResourceConfig, so the list
 * and form components never need to know which module or HTTP verbs a
 * given resource actually uses.
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiClientService);

  list<T = Record<string, unknown>>(resource: AdminResourceConfig): Observable<T[]> {
    return this.api
      .get<T[]>(resource.moduleName, resource.listPath)
      .pipe(map((res) => res.data));
  }

  create<T = Record<string, unknown>>(
    resource: AdminResourceConfig,
    data: Record<string, unknown>,
  ): Observable<T> {
    const path =
      typeof resource.createPath === 'function'
        ? resource.createPath(data)
        : (resource.createPath ?? resource.listPath);
    const method = resource.createMethod ?? 'POST';
    const request =
      method === 'PUT'
        ? this.api.put<T>(resource.moduleName, path, data)
        : this.api.post<T>(resource.moduleName, path, data);
    return request.pipe(map((res) => res.data));
  }

  update<T = Record<string, unknown>>(
    resource: AdminResourceConfig,
    id: string,
    data: Record<string, unknown>,
  ): Observable<T> {
    const path = resource.updatePath ? resource.updatePath(id) : `${resource.listPath}/${id}`;
    const method = resource.updateMethod ?? 'PATCH';
    const request =
      method === 'PUT'
        ? this.api.put<T>(resource.moduleName, path, data)
        : this.api.patch<T>(resource.moduleName, path, data);
    return request.pipe(map((res) => res.data));
  }

  remove(resource: AdminResourceConfig, id: string): Observable<void> {
    const path = resource.deletePath ? resource.deletePath(id) : `${resource.listPath}/${id}`;
    return this.api.delete(resource.moduleName, path);
  }
}
