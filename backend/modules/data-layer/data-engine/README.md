# data-engine

Define a new entity, get a database collection and a REST API —
programmatically, with no code change or restart. Phase 5 of the
pro-code assistant work.

## Scope: NoSQL first

Every entity researched elsewhere that claims this ("generic entity +
auto-REST-API") — Supabase, NocoDB, Baserow, Retool Database — is
secretly Postgres underneath; none of them actually unifies relational
and document storage behind one interface. This module takes the other
half first: **MongoDB only**, dynamically-registered Mongoose models,
schema-on-write validated against the entity's declared fields. A real
relational path (Postgres DDL executed at runtime) is deliberately out
of scope for now — it's a materially different risk profile (DDL
injection surface, migrations, rollback) that deserves its own pass
once there's a concrete need for genuine relational joins beyond what
embedded documents/refs already cover.

## How it works

`EntityRegistryService` is the only thing that knows Mongoose exists.
Defining an entity (`POST /entities`) just stores its field list; the
actual data collection is a Mongoose model registered **at runtime**
via `Connection.model()` the first time anything touches that entity's
data — no restart needed, because nothing about this is compiled in.
`DataService` validates every write against the entity's own
zod-built schema (derived from the same field list) before it reaches
Mongoose, so a wrong type is a clear 400, not a cast error.

## Endpoints

- `POST /entities` — `{ name, fields: [{ name, type, required? }] }`,
  `type` one of `string | number | boolean | date`.
- `GET /entities`, `GET /entities/:name`, `DELETE /entities/:name`
  (also drops the entity's data collection).
- `GET /data/:entity`, `POST /data/:entity`, `GET /data/:entity/:id`,
  `PATCH /data/:entity/:id`, `DELETE /data/:entity/:id` — generic CRUD
  against whatever entity was defined, validated against its fields.

## Local dev

```bash
cp .env.example .env
pnpm install
pnpm run start:dev
```

Needs MongoDB running (see `../../docker-compose.yml`) and the Registry
module up so this can self-register.
