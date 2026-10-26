# files

Generic binary storage — the one capability missing from every module when this was looked at: no module anywhere stored a file. Deliberately knows nothing about any particular app ("Confluence attachments", "Jira avatars") — it just stores bytes under an id and hands that id back, the same shape as `reference`: no join on read, the owning app resolves it.

## Why GridFS

Uses MongoDB's own GridFS (the native `mongodb` driver's `GridFSBucket`, not a Mongoose schema — GridFS keeps its own `fs.files`/`fs.chunks` collections) instead of standing up S3 or a disk volume. Every other module already depends on Mongo, so this needs no new infrastructure to run via `dev-up.sh` locally or in production.

## Model

Just bytes + metadata (filename, MIME type, size) addressed by an id GridFS itself generates. `data-engine`'s `file` field type stores that id as a plain string, exactly like its `reference` field type stores another record's id.

## Endpoints

`POST /files` (multipart, field name `file`) → `{id, filename, mimeType, size}`. `GET /files/:id` streams the raw bytes with the original `Content-Type`. `DELETE /files/:id`.

## No actions-engine registration

A multipart upload isn't expressible as a generic JSON action schema, and the download endpoint streams binary, not an envelope — both are a poor fit for the actions-engine contract. Callers (the frontend, or another module attaching a file to one of its own records) talk to these REST endpoints directly through the Gateway.
