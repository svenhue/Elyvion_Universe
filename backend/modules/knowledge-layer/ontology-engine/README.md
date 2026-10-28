# ontology-engine

Models a company's relevant IT landscape — data sources, processes,
objects (e.g. vehicles), and the relationships between them — as a graph
("ontology"), the way Palantir Foundry's ontology layer sits on top of an
enterprise's existing systems rather than replacing them. Not a full
enterprise-wide model: just the slice that's relevant to getting value
out of the platform.

Python/FastAPI (not NestJS, like this project's other backend modules)
because graph-shaped data at this kind of scale is a different workload
than the relational/document stores the rest of the backend uses, and
Neo4j is the established choice for it — async end-to-end (FastAPI +
the async Neo4j driver), so a slow graph query never blocks the process
from serving other requests.

## Data model

- **Ontology** (`:Ontology`) — a named container; a company could have
  more than one (e.g. per business unit).
- **OntologyNode** (`:OntologyNode`) — one entity: a data source, a
  process, an object/vehicle, whatever the ontology's author models.
  `type` (e.g. `"Vehicle"`) and arbitrary scalar `attributes` are plain
  properties, not dynamic Neo4j labels — labels can't be parameterized
  in Cypher, so keeping them fixed (`:OntologyNode` for every node,
  `:RELATES_TO` for every relationship) and putting the user-defined
  type in data is what keeps every query fully parameterized, with no
  Cypher-injection surface.
- **Relationship** (`:RELATES_TO`) — one edge between two nodes, with
  its own `type` (e.g. `"feeds_into"`) and attributes.

`attributes` can only hold scalars (string/number/boolean) — Neo4j
property values can't be nested objects, so this isn't a simplification,
it's the actual constraint the graph itself has.

Ontologies also carry a `type` — which template/vocabulary an ontology
follows (e.g. `"angular_app_config"`, `"elyvion_platform_environment"`,
`"custom"`). Node/edge creation is upsert (Cypher `MERGE`, keyed by an
optional caller-supplied node `id`, or by the `(source, target, type)`
tuple for edges) — what lets a sync job call this repeatedly without
duplicating what it already created.

### Vocabulary per ontology type

`"custom"` ontologies are free-form — whoever edits them picks their own
node/edge types. The two built-in, auto-synced types are not: each has a
single, fixed relationship so a reader can tell what an edge means from
its type string alone, without having to read the sync code that
produced it.

- **`angular_app_config`** — root node type `AngularApplication`;
  every other node is one of the app's own elements/components. The one
  edge type is **`ist_element`**, always parent → child (root → its
  top-level element, element → its children) — "is an element of" reads
  the same way regardless of which level it's at, so there's no need for
  a second edge type just to name the root→element case differently.
- **`elyvion_platform_environment`** — root node type
  `EnvironmentInstance`, named `"environment"`; every other node is a
  `BackendService` or `FrontendApp`. The one edge type is
  **`läuft_in`** ("runs in"), always service → environment — a service
  runs *in* the environment, not the other way round, so the arrow
  points from the thing that depends on the environment to the
  environment itself, the same direction `ist_element` points from the
  more specific thing to the more general one.

## `app/environment` — the platform "observer"

A submodule, not a separate service: mirrors the running Elyvion
platform itself (every module registered with the Registry, plus a
small static list of frontend apps — there's no self-registration story
for those yet) into its own `"elyvion_platform_environment"` ontology,
on an optional 30s background tick. Settings (on/off) persist in Neo4j
as a tiny singleton node, so they survive a restart. See
`PlatformEnvironmentSettingsComponent` (frontend `admin` → "Platform-
Umgebung") for the on/off toggle and manual "sync now".

## Endpoints

- `POST/GET /ontologies`, `GET/DELETE /ontologies/{key}`
- `GET /ontologies/{key}/graph` — the whole graph in one call, for the frontend's graph view
- `POST/GET /ontologies/{key}/nodes`, `GET/PATCH/DELETE /ontologies/{key}/nodes/{id}`
- `POST/GET /ontologies/{key}/edges`, `PATCH/DELETE /ontologies/{key}/edges/{id}`
- `GET/PUT /environment/settings`, `POST /environment/sync`

## Local dev

```bash
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8100
```

Needs Neo4j running — see `../../../docker-compose.yml` (Browser UI at
http://localhost:7474, default auth `neo4j` / `elyvion-ontology`).
