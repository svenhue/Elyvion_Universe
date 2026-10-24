import { AdapterType } from '../schemas/data-adapter.schema';

export interface DataAdapterRunResult {
  recordsProcessed: number;
}

/**
 * One source-system integration, behind a single shape — "start a stream"
 * means the same thing (validate config once, `run()` on trigger or on a
 * cron tick) whether the source is a REST endpoint today or SAP/JDBC once
 * those are implemented. Adding a source system means adding one class
 * here and one line in `connector-registry.ts`; nothing else in the
 * module changes.
 */
export interface DataAdapterConnector {
  readonly type: AdapterType;

  /** Throws with a clear message if `connectionConfig` is missing something this connector needs. */
  validateConfig(connectionConfig: Record<string, unknown>): void;

  run(connectionConfig: Record<string, unknown>): Promise<DataAdapterRunResult>;
}
