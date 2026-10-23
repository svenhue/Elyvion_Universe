import { InjectionToken } from '@angular/core';

export type AdminFieldType = 'text' | 'number' | 'boolean' | 'textarea' | 'json';

export interface AdminField {
  key: string;
  label: string;
  type: AdminFieldType;
  /** Shown as a column in the list table. Default true. */
  inList?: boolean;
  /** Editable in the create/edit form (vs. read-only, e.g. an id or status). Default true. */
  editable?: boolean;
  required?: boolean;
}

/**
 * Declaratively describes one REST resource (= one DB table/collection,
 * reached through the Gateway at /api/{moduleName}{listPath}) for the
 * generic admin CRUD UI. One config per table — see
 * provideAdminResources() in a host app for the concrete list.
 */
export interface AdminResourceConfig {
  /** Used in the route (/admin/:id) and as the React-key-like identity in nav. */
  id: string;
  label: string;
  moduleName: string;
  /** e.g. '/roles', '' for the module root. */
  listPath: string;
  /** Field holding each record's unique id (not necessarily "id" — Registry uses "name"). */
  idField: string;
  fields: AdminField[];

  creatable?: boolean;
  editable?: boolean;
  deletable?: boolean;

  /** Default: POST to listPath. A function is useful when the id must be in
   * the URL even on create (e.g. an upsert-style `PUT /resource/:id`). */
  createMethod?: 'POST' | 'PUT';
  createPath?: string | ((data: Record<string, unknown>) => string);
  /** Default: PATCH to `${listPath}/${id}`. */
  updateMethod?: 'PATCH' | 'PUT';
  updatePath?: (id: string) => string;
  /** Default: DELETE `${listPath}/${id}`. */
  deletePath?: (id: string) => string;
}

export const ADMIN_RESOURCES = new InjectionToken<AdminResourceConfig[]>('ADMIN_RESOURCES');
