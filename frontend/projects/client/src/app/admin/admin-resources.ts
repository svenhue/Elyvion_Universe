import { AdminResourceConfig } from '@elyvion/shared-lib';

/**
 * One entry per DB table/collection across every backend module — this is
 * the only place that needs to change when a module grows a new table.
 * See docs/content/admin.md for the generic admin module's contract.
 */
export const ADMIN_RESOURCE_CONFIGS: AdminResourceConfig[] = [
  {
    id: 'registry-modules',
    label: 'Registry: Module',
    moduleName: 'registry',
    listPath: '/modules',
    idField: 'name',
    creatable: false, // modules self-register; the admin UI only edits/removes
    fields: [
      { key: 'name', label: 'Name', type: 'text', editable: false },
      { key: 'type', label: 'Typ', type: 'text' },
      { key: 'baseUrl', label: 'Base URL', type: 'text' },
      { key: 'routePrefix', label: 'Route Prefix', type: 'text' },
      { key: 'healthCheckUrl', label: 'Health URL', type: 'text' },
      { key: 'version', label: 'Version', type: 'text' },
      { key: 'status', label: 'Status', type: 'text', editable: false },
    ],
  },
  {
    id: 'users',
    label: 'Users: Accounts',
    moduleName: 'users',
    listPath: '',
    idField: 'id',
    creatable: false, // registration has its own flow (password handling)
    updatePath: (id) => `/by-id/${id}`,
    deletePath: (id) => `/by-id/${id}`,
    fields: [
      { key: 'id', label: 'ID', type: 'text', editable: false },
      { key: 'email', label: 'E-Mail', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'roles', label: 'Rollen', type: 'json', editable: false },
    ],
  },
  {
    id: 'roles',
    label: 'Users: Rollen',
    moduleName: 'users',
    listPath: '/roles',
    idField: 'id',
    fields: [
      { key: 'id', label: 'ID', type: 'text', editable: false, inList: false },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'permissions', label: 'Permissions', type: 'json', editable: false },
    ],
  },
  {
    id: 'permissions',
    label: 'Users: Permissions',
    moduleName: 'users',
    listPath: '/permissions',
    idField: 'id',
    fields: [
      { key: 'id', label: 'ID', type: 'text', editable: false, inList: false },
      { key: 'name', label: 'Name', type: 'text', required: true },
    ],
  },
  {
    id: 'app-configs',
    label: 'App-Config: Anwendungen',
    moduleName: 'app-config',
    listPath: '/configs',
    idField: 'applicationId',
    createMethod: 'PUT', // the backend endpoint is an upsert — same verb for create and edit
    createPath: (data) => `/configs/${data['applicationId']}`,
    updateMethod: 'PUT',
    updatePath: (id) => `/configs/${id}`,
    deletePath: (id) => `/configs/${id}`,
    fields: [
      { key: 'applicationId', label: 'Application ID', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'version', label: 'Version', type: 'text' },
      { key: 'rootComponentId', label: 'Root Component ID', type: 'text', required: true },
      { key: 'components', label: 'Components (JSON)', type: 'json', inList: false },
    ],
  },
];
