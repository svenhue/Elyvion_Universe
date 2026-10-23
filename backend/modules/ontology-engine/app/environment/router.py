from fastapi import APIRouter, Depends
from neo4j import AsyncSession

from ..db import get_session
from . import service
from .schemas import EnvironmentSettings, EnvironmentSyncResult

router = APIRouter(prefix="/environment", tags=["environment"])
Session = Depends(get_session)


@router.get("/settings")
async def get_settings(session: AsyncSession = Session) -> EnvironmentSettings:
    return await service.get_settings(session)


@router.put("/settings")
async def set_settings(settings: EnvironmentSettings, session: AsyncSession = Session) -> EnvironmentSettings:
    saved = await service.set_settings(session, settings)
    if saved.enabled:
        await service.sync_environment(session)
    return saved


@router.post("/sync")
async def trigger_sync(session: AsyncSession = Session) -> EnvironmentSyncResult:
    return await service.sync_environment(session)
