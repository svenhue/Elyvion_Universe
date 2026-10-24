# data-adapters

Connects external data sources (ERP systems like SAP, other backend systems, files, databases) to the Elyvion platform through one configurable, pluggable interface, and exposes "start a stream" / "schedule a cronjob" as actions so workflows and AI agents can drive integrations the same way a person would.

## Architecture

- **`DataAdapterConfig`** (Mongo) — a named adapter: `type`, a type-specific `connectionConfig`, and an optional cron `schedule`.
- **`DataAdapterConnector`** (`connectors/connector.interface.ts`) — one shape every source system implements: `validateConfig()` + `run()`. Adding a new source system means adding one class and one line in `connector-registry.ts`; nothing else in the module changes.
  - `http` — generic REST/OData pull. Covers plain JSON APIs **and** SAP systems that expose an OData service, which is the common SAP integration path.
  - `file` — reads a local/mounted CSV file. Stands in for SFTP-based file drops (same config shape; swapping the file read for an SFTP download is the only change needed).
  - `jdbc`, `sap` — declared in `ADAPTER_TYPES` and selectable in the UI so the target architecture is visible, but **not implemented**: a real JDBC or SAP RFC connector needs a licensed/native client library this environment doesn't have. Selecting one throws a clear `501 Not Implemented` rather than silently doing nothing.
- **`DataAdapterRun`** (Mongo) — one record per execution (manual trigger or cron tick): status, timing, records processed, error.
- Cron scheduling is dynamic: `AdaptersService` adds/removes a `CronJob` in Nest's `SchedulerRegistry` whenever an adapter's `schedule` changes, and re-registers every enabled+scheduled adapter on process start (the registry itself holds nothing across restarts).

## Actions (via actions-engine)

`list_data_adapters`, `create_data_adapter`, `delete_data_adapter`, `start_data_stream`, `schedule_data_adapter`, `list_data_adapter_runs` — see `main.ts` for exact input shapes.

## Endpoints

`POST /adapters`, `GET /adapters`, `GET /adapters/:id`, `PATCH /adapters/:id`, `PATCH /adapters/:id/schedule`, `DELETE /adapters/:id`, `POST /adapters/:id/runs`, `GET /adapters/:id/runs`.
