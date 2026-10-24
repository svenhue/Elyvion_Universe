"""Mirrors the TypeScript logEvent() helper. Fire-and-forget — a logging
call failing must never break whatever it's logging, so this neither
retries nor raises, just swallows the error (unlike register_module()/
register_remote_action(), which retry because a missed *registration*
really does need to succeed eventually)."""

from dataclasses import dataclass
from typing import Any, Literal

import httpx


@dataclass
class LogEventOptions:
    logging_url: str
    source: str
    message: str
    level: Literal["debug", "info", "warn", "error"] = "info"
    action_key: str | None = None
    context: dict[str, Any] | None = None


async def log_event(options: LogEventOptions) -> None:
    payload = {
        "source": options.source,
        "message": options.message,
        "level": options.level,
        "actionKey": options.action_key,
        "context": options.context,
    }
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(f"{options.logging_url}/logs", json=payload)
    except httpx.HTTPError:
        pass
