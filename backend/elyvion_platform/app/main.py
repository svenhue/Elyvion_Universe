from contextlib import asynccontextmanager
from urllib.parse import quote

import asyncpg
from elyvion_shared import (
    GridFSFileStore,
    LogStore,
    RegisterModuleOptions,
    StoredFileNotFound,
    configure_logging,
    install_exception_handlers,
    register_module,
)
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pymongo import AsyncMongoClient

from .config import settings
from .schemas import (
    CreateLogRequest,
    Envelope,
    LogEntryResponse,
    LogLevel,
    StoredFileResponse,
)

configure_logging(settings.module_name, settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    postgres_pool = await asyncpg.create_pool(settings.database_url)
    mongo_client = AsyncMongoClient(settings.mongodb_uri)
    try:
        await mongo_client.admin.command("ping")
        database = mongo_client.get_default_database()
        log_store = LogStore(postgres_pool)
        await log_store.initialize()
        app.state.log_store = log_store
        app.state.file_store = GridFSFileStore(database)

        await register_module(
            RegisterModuleOptions(
                registry_url=settings.registry_url,
                name=settings.module_name,
                type="py",
                base_url=settings.module_base_url,
                route_prefix="/",
                health_check_url=f"{settings.module_base_url}/health",
                version="0.1.0",
            )
        )
        yield
    finally:
        await mongo_client.close()
        await postgres_pool.close()


app = FastAPI(title=settings.module_name, lifespan=lifespan)
install_exception_handlers(app)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.module_name}


@app.post("/logs", response_model=Envelope[LogEntryResponse])
async def create_log(payload: CreateLogRequest, request: Request):
    return {
        "data": await request.app.state.log_store.create(
            source=payload.source,
            level=payload.level,
            message=payload.message,
            action_key=payload.action_key,
            context=payload.context,
        )
    }


@app.get("/logs", response_model=Envelope[list[LogEntryResponse]])
async def list_logs(
    request: Request,
    source: str | None = None,
    level: LogLevel | None = None,
    action_key: str | None = Query(default=None, alias="actionKey"),
    limit: int = Query(default=100, ge=1, le=500),
):
    return {
        "data": await request.app.state.log_store.list(
            source=source,
            level=level,
            action_key=action_key,
            limit=limit,
        )
    }


@app.post("/files", response_model=Envelope[StoredFileResponse])
async def upload_file(request: Request, file: UploadFile = File(...)):
    content = await file.read()
    result = await request.app.state.file_store.upload(
        content,
        file.filename or "upload",
        file.content_type or "application/octet-stream",
    )
    return {
        "data": {
            "id": result.id,
            "filename": result.filename,
            "mimeType": result.mime_type,
            "size": result.size,
        }
    }


@app.get("/files/{file_id}")
async def download_file(file_id: str, request: Request):
    try:
        stored_file = await request.app.state.file_store.download(file_id)
    except StoredFileNotFound as exc:
        raise HTTPException(
            status_code=404, detail=f'Datei "{file_id}" wurde nicht gefunden.'
        ) from exc

    return StreamingResponse(
        stored_file.stream,
        media_type=None,
        headers={
            "Content-Type": stored_file.mime_type,
            "Content-Length": str(stored_file.size),
            "Content-Disposition": (
                "inline; filename*=UTF-8''"
                f"{quote(stored_file.filename, safe='')}"
            ),
        },
    )


@app.delete("/files/{file_id}")
async def remove_file(file_id: str, request: Request):
    try:
        await request.app.state.file_store.remove(file_id)
    except StoredFileNotFound as exc:
        raise HTTPException(
            status_code=404, detail=f'Datei "{file_id}" wurde nicht gefunden.'
        ) from exc
    return {"data": {"removed": True}}
