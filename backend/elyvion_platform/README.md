# elyvion-platform

Shared platform APIs for log persistence and GridFS file storage. The
storage implementations live in `packages/shared-py/src/elyvion_shared`;
this service hosts their HTTP APIs so TypeScript modules and the frontend
can use them without separate `logging` and `files` microservices.

## Endpoints

- `POST /logs` and `GET /logs` — create and filter log entries.
- `POST /files` — upload a multipart file in the `file` field.
- `GET /files/:id` — stream a stored file.
- `DELETE /files/:id` — delete a stored file.

The service registers as `elyvion_platform` with the Registry. Existing
GridFS uploads remain in the `elyvion_files` database and `uploads` bucket.
Log entries remain in the PostgreSQL `logging` schema.

## Local development

```bash
cd backend/elyvion_platform
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 3030
```

Requires the shared PostgreSQL, MongoDB, and Registry services.
