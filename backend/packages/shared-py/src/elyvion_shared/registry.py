"""Self-registration against the Registry service, mirroring the
TypeScript registerModule() helper. Call once from the FastAPI app's
startup lifespan handler."""

import asyncio
from dataclasses import dataclass
from typing import Literal

import httpx

from .logging import get_logger

logger = get_logger(__name__)


@dataclass
class RegisterModuleOptions:
    registry_url: str
    name: str
    type: Literal["ts", "py"]
    base_url: str
    route_prefix: str
    health_check_url: str
    version: str


async def register_module(
    options: RegisterModuleOptions, retries: int = 5, delay_seconds: float = 2.0
) -> None:
    payload = {
        "name": options.name,
        "type": options.type,
        "baseUrl": options.base_url,
        "routePrefix": options.route_prefix,
        "healthCheckUrl": options.health_check_url,
        "version": options.version,
    }

    async with httpx.AsyncClient(timeout=3.0) as client:
        for attempt in range(1, retries + 1):
            try:
                response = await client.post(
                    f"{options.registry_url}/modules/register", json=payload
                )
                response.raise_for_status()
                return
            except httpx.HTTPError as exc:
                if attempt == retries:
                    logger.error(
                        "registry_registration_failed",
                        module=options.name,
                        attempts=retries,
                        error=str(exc),
                    )
                    return
                await asyncio.sleep(delay_seconds)
