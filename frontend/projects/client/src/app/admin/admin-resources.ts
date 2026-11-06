import { AdminResourceConfig } from '@elyvion/shared-lib';

/**
 * One entry per DB table/collection across every backend module — this is
 * the only place that needs to change when a module grows a new table.
 * See docs/content/admin.md for the generic admin module's contract.
 */
export const ADMIN_RESOURCE_CONFIGS: AdminResourceConfig[] = [
  {
    id: 'local-llm-configuration',
    label: 'Local LLM: Plattform-Konfiguration',
    moduleName: 'local-llm',
    listPath: '/configurations',
    idField: 'scope',
    creatable: false,
    deletable: false,
    updatePath: (id) => `/configurations/${id}`,
    fields: [
      { key: 'scope', label: 'Geltungsbereich', type: 'text', editable: false },
      { key: 'baseUrl', label: 'Ollama URL', type: 'text', required: true },
      { key: 'model', label: 'Modell', type: 'text', required: true },
      { key: 'temperature', label: 'Temperatur', type: 'number', required: true },
      { key: 'numCtx', label: 'Kontextgröße', type: 'number', required: true },
      { key: 'updatedAt', label: 'Geändert am', type: 'text', editable: false, inList: false },
    ],
  },
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
