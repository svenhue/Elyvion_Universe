"""Self-registration against actions-engine, mirroring the TypeScript
registerRemoteAction() helper — the generalization that lets any module
(Python ones included) expose its own actions without actions-engine
needing code for it. Call once from the FastAPI app's startup lifespan
handler, same as register_module()."""

import asyncio
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from .logging import get_logger

logger = get_logger(__name__)


@dataclass
class RegisterRemoteActionOptions:
    actions_engine_url: str
    key: str
    name: str
    description: str
    module_name: str
    path: str
    input_schema: dict[str, Any]
    category: str | None = None
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "POST"


async def register_remote_action(
    options: RegisterRemoteActionOptions, retries: int = 5, delay_seconds: float = 2.0
) -> None:
    payload = {
        "key": options.key,
        "name": options.name,
        "description": options.description,
        "category": options.category,
        "inputSchema": options.input_schema,
        "moduleName": options.module_name,
        "path": options.path,
        "method": options.method,
    }

    async with httpx.AsyncClient(timeout=3.0) as client:
        for attempt in range(1, retries + 1):
            try:
                response = await client.post(
                    f"{options.actions_engine_url}/remote-actions", json=payload
                )
                response.raise_for_status()
                return
            except httpx.HTTPError as exc:
                if attempt == retries:
                    logger.error(
                        "remote_action_registration_failed",
                        key=options.key,
                        attempts=retries,
                        error=str(exc),
                    )
                    return
                await asyncio.sleep(delay_seconds)
