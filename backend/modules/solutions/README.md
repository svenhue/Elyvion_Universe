# solutions

A named, deployable bundle of apps, workflows, AI agents, knowledge graphs and data entities — the organizing unit for an enterprise defining dozens of applications and many workflows/agents, rather than one flat, ungrouped list of everything. "Deploy this as a whole" (`deployment-engine`'s `Deployment.solutionKey`) refers to a Solution, not a single app.

## Why "Solution" and not "Resource"

The user's own term for this concept is "Ressource." That collides with `security`'s `Resource` — a backend module acting as a permission boundary, an unrelated concept that already exists in this codebase. To keep the two apart, this module calls its bundling concept a **Solution** in code (and "Lösung" in the German UI) — a deliberate naming choice, not an oversight.

## Model

- **`Solution`** — `key`, `name`, `description`, and a `members` array.
- **`SolutionMember`** — `{ resourceType, resourceKey, label? }`. A Solution never copies another module's data, only references it: `resourceType` is one of `application | workflow | agent | knowledge_graph | entity`, and `resourceKey` is that member's own natural key in its owning module (an `app-config` applicationId, a `workflow-engine` workflow key, an `agent-engine` config id, an `ontology-engine` knowledge-graph key, or a `data-engine` entity name).

## What's deliberately not done yet

Deploying a Solution "as a whole" is not yet a single build: `deployment-engine`'s `local-docker` executor still only knows how to package the one global client bundle (see its own README) — `Deployment.solutionKey` is wired so a deployment can be *associated with* a Solution, but building one artifact out of N member apps needs today's App-Builder to support multiple named applications first. This module's job right now is the catalog — grouping and referencing — not the build pipeline.

## Actions (via actions-engine)

`list_solutions`, `create_solution`, `add_solution_member`, `remove_solution_member`.

## Endpoints

`POST /solutions`, `GET /solutions`, `GET /solutions/:key`, `DELETE /solutions/:key`, `POST /solutions/:key/members`, `DELETE /solutions/:key/members/:resourceType/:resourceKey`.
