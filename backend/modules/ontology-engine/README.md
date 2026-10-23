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

## Endpoints

- `POST/GET /ontologies`, `GET/DELETE /ontologies/{key}`
- `GET /ontologies/{key}/graph` — the whole graph in one call, for the frontend's graph view
- `POST/GET /ontologies/{key}/nodes`, `GET/PATCH/DELETE /ontologies/{key}/nodes/{id}`
- `POST/GET /ontologies/{key}/edges`, `PATCH/DELETE /ontologies/{key}/edges/{id}`

## Local dev

```bash
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8100
```

Needs Neo4j running — see `../../docker-compose.yml` (Browser UI at
http://localhost:7474, default auth `neo4j` / `elyvion-ontology`).
