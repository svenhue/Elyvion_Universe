# repository

A named, Mongo-backed bundle of **definitions** — Workflow-/Entitäts-/Anwendungs-/Aktions-/Regel-Definitionen — "ein Repository kann aus Workflow-Definition, Entitätsdefinition, Anwendungsdefinition, Aktionsdefinition oder aus Logik bestehen." Not version control (no diffing, no history of its own — that's `version-control`'s job); a Repository is simply a curated set of references, the design-time counterpart to `solutions`' deploy-time Solution.

## The Kernrepository is not a document here

"Das Kernrepository [ist dort], wo per Default alles abgespeichert wird" — every object the platform knows about belongs to it by default. That default membership is **computed**, not stored: the frontend's Kernrepository view queries each owning module's own list endpoint (workflow-engine, data-engine, rules-engine, …) directly. Keeping it computed means no module needs a creation-hook into this one, and there's nothing to backfill for objects that already existed. Only **user-created** repositories — curated subsets, not "everything" — are real `Repository` documents.

## Copying between repositories

"Vom Kernrepository eine Workflow-Definition auf ein neues Repository kopieren" is two steps, both done by the frontend (this module never calls another module itself):

1. The owning module's own create endpoint is called to physically duplicate the object (e.g. `workflow-engine`'s `POST /definitions` with a new key, same steps).
2. `POST /repositories/:key/members` adds a membership row with `copiedFrom: { resourceType, resourceKey }` pointing at the original.

When the original is later updated, the owning module's edit UI calls `GET /repositories/copies?resourceType=&resourceKey=` to find every copy, and offers to update them too — "wird quasi gefragt, ob das in dem anderen Repository auch geupdatet werden soll." Never automatic.

## Repository → Solution

"Ich kann ein Repository nehmen und sagen, ich möchte das Repository jetzt deployen, und dann entsteht eine Lösung." There's no endpoint here for that — the frontend reads a Repository's `members` and either calls `solutions`' `POST /solutions` + `PATCH /:key/members` (first deploy, or "always create a new Solution") or `PATCH /solutions/:key/members` on the Solution already linked via `sourceRepositoryKey` (update-in-place redeploy). Both are supported; the Repository page lets you choose per deploy.

## Model

- **`Repository`** — `key`, `name`, `description?`, `members: RepositoryMember[]`.
- **`RepositoryMember`** — `{ resourceType, resourceKey, label?, copiedFrom?: { resourceType, resourceKey } }`. Same `ResourceType` union as `solutions`' `SolutionMember` (duplicated per module, not shared — each module here is deployed independently): `application | workflow | agent | knowledge_graph | entity | action | rule | repository | solution`.

## Actions (via actions-engine)

`list_repositories`, `create_repository`, `add_repository_member`, `remove_repository_member`.

## Endpoints

`POST /repositories`, `GET /repositories`, `GET /repositories/copies?resourceType=&resourceKey=`, `GET /repositories/:key`, `DELETE /repositories/:key`, `POST /repositories/:key/members`, `DELETE /repositories/:key/members/:resourceType/:resourceKey`.
