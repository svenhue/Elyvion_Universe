# version-control

A generic change-history ledger — "diese ganze Ressource brauche ich dann eben auch das Thema Version Control, Change Management." Any module can call `POST /versions` whenever one of its own objects changes, the same "one cross-cutting service every other module calls into" shape as `logging`.

## Model

- **`ObjectVersion`** — `{ resourceType, resourceKey, version, snapshot, changedBy?, createdAt }`. `version` auto-increments per `(resourceType, resourceKey)` pair; nothing is ever overwritten, so the history is always complete.

## What this module does NOT do

It never interprets `snapshot` and never writes it back anywhere — restoring a version is the *owning* module's job (read the snapshot via `GET /versions/:resourceType/:resourceKey/:version`, then call that module's own update endpoint with it). This module is purely the ledger, not a generic "undo" engine — a real restore needs the owning module's own validation (e.g. rules-engine re-validating a restored rule's blocks), which only it can do.

## Which modules call this today

Wired into `rules-engine` (on every rule update), `solutions` (on every member add/remove), and `data-adapters` (on every adapter update) as a working example of the pattern — see each module's `*.service.ts`. Extending it to the rest (`workflow-engine`, `data-engine`, `agent-engine`) is mechanical: one `recordVersion()` call (see `@elyvion/shared`) added to that module's own update path, nothing here changes.

## Actions (via actions-engine)

`get_object_history`.

## Endpoints

`POST /versions`, `GET /versions?resourceType=&resourceKey=`, `GET /versions/:resourceType/:resourceKey/history` (same lookup, path-based — see the action registration), `GET /versions/:resourceType/:resourceKey/latest`, `GET /versions/:resourceType/:resourceKey/:version`.
