import asyncio
import ipaddress
import logging
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

import httpx

_logger = logging.getLogger(__name__)
_module_name = "unknown"
_ingestion_config: tuple[str, str] | None = None
_config_loaded = False
_warning_logged = False


def configure_traffic(
    module_name: str,
    ingestion_url: str | None = None,
    token_file: str | None = None,
    environment: str = "development",
) -> None:
    global _module_name
    _module_name = module_name
    _load_ingestion_config(ingestion_url, token_file, environment)


class TrafficObservabilityMiddleware:
    def __init__(self, app: Any, module_name: str):
        self.app = app
        self.module_name = module_name

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        started = time.monotonic()
        headers = _headers(scope.get("headers", []))
        request_bytes = _byte_count(headers.get("content-length"))
        status_code: int | None = None
        response_bytes = 0
        recorded = False

        async def send_with_observation(message: dict) -> None:
            nonlocal status_code, response_bytes, recorded
            response_complete = False
            if message.get("type") == "http.response.start":
                status_code = message.get("status")
            elif message.get("type") == "http.response.body":
                response_bytes += len(message.get("body", b""))
                response_complete = not message.get("more_body", False)
            await send(message)
            if (
                message.get("type") == "http.response.body"
                and response_complete
                and not recorded
            ):
                recorded = True
                _schedule_event(_server_event(
                    scope,
                    headers,
                    self.module_name,
                    status_code,
                    request_bytes,
                    response_bytes,
                    time.monotonic() - started,
                ))

        try:
            await self.app(scope, receive, send_with_observation)
        except Exception:
            if not recorded:
                _schedule_event(_server_event(
                    scope,
                    headers,
                    self.module_name,
                    status_code or 500,
                    request_bytes,
                    response_bytes,
                    time.monotonic() - started,
                    error=True,
                ))
            raise


def create_traffic_httpx_hooks() -> dict[str, list]:
    async def on_request(request: httpx.Request) -> None:
        request.extensions["elyvion_traffic_started"] = time.monotonic()

    async def on_response(response: httpx.Response) -> None:
        request = response.request
        if normalize_path(request.url.path) == "/internal/events":
            return
        started = request.extensions.get("elyvion_traffic_started")
        correlation_id = _correlation_id(request.headers.get("x-correlation-id"))
        event = {
            "direction": "client",
            "protocol": request.url.scheme if request.url.scheme in {"http", "https"} else "http",
            "sourceService": _module_name,
            "targetService": _service_name(request.url.host),
            "method": request.method.upper() if re.fullmatch(r"[A-Za-z]{1,16}", request.method) else "UNKNOWN",
            "path": normalize_path(request.url.path),
            "statusCode": response.status_code,
            "durationMs": max(0, round((time.monotonic() - started) * 1000)) if isinstance(started, float) else None,
            "requestBytes": _byte_count(request.headers.get("content-length")),
            "responseBytes": _byte_count(response.headers.get("content-length")),
            "correlationId": correlation_id,
        }
        if response.status_code >= 500:
            event["errorCode"] = f"HTTP_{response.status_code}"
            event["errorDetail"] = f"HTTP response status {response.status_code}"
        _schedule_event(event)

    return {"request": [on_request], "response": [on_response]}


def normalize_path(value: str) -> str:
    segments = urlsplit(value).path.split("/")
    normalized: list[str] = []
    for index, raw_segment in enumerate(segments):
        if not raw_segment:
            normalized.append("")
            continue
        try:
            segment = unquote(raw_segment, errors="strict")
        except (UnicodeDecodeError, ValueError):
            normalized.append("[REDACTED]")
            continue
        if index > 0 and re.fullmatch(
            r"(?i)(token|secret|password|credential|api[-_]?key|authorization)", segments[index - 1]
        ):
            normalized.append("[REDACTED]")
        elif re.fullmatch(r"\d{4,}", segment) or re.fullmatch(r"(?i)[0-9a-f]{8}-[0-9a-f-]{27,}", segment):
            normalized.append(":id")
        elif len(segment) >= 16 or "@" in segment:
            normalized.append("[REDACTED]")
        else:
            normalized.append(segment.replace("\r", "").replace("\n", ""))
    return "/".join(normalized)[:256] or "/"


def _server_event(
    scope: dict,
    headers: dict[str, str],
    module_name: str,
    status_code: int | None,
    request_bytes: int | None,
    response_bytes: int,
    duration_seconds: float,
    error: bool = False,
) -> dict[str, Any]:
    path = normalize_path(scope.get("path", "/"))
    event: dict[str, Any] = {
        "direction": "server",
        "protocol": "https" if scope.get("scheme") == "https" else "http",
        "sourceService": "external",
        "targetService": module_name,
        "method": scope.get("method", "UNKNOWN").upper(),
        "path": path,
        "statusCode": status_code,
        "requestBytes": request_bytes,
        "responseBytes": min(response_bytes, 2_147_483_647),
        "durationMs": max(0, round(duration_seconds * 1000)),
        "correlationId": _correlation_id(headers.get("x-correlation-id")),
    }
    if error or (status_code is not None and status_code >= 500):
        event["errorCode"] = f"HTTP_{status_code or 500}"
        event["errorDetail"] = f"HTTP response status {status_code or 500}"
    return event


def _client_error_event(request: httpx.Request, started: float) -> dict[str, Any]:
    return {
        "direction": "client",
        "protocol": request.url.scheme if request.url.scheme in {"http", "https"} else "http",
        "sourceService": _module_name,
        "targetService": _service_name(request.url.host),
        "method": request.method.upper() if re.fullmatch(r"[A-Za-z]{1,16}", request.method) else "UNKNOWN",
        "path": normalize_path(request.url.path),
        "durationMs": max(0, round((time.monotonic() - started) * 1000)),
        "requestBytes": _byte_count(request.headers.get("content-length")),
        "correlationId": _correlation_id(request.headers.get("x-correlation-id")),
        "errorCode": "HTTP_CLIENT_ERROR",
        "errorDetail": "HTTP request failed",
    }


def record_httpx_failure(error: httpx.HTTPError) -> None:
    if isinstance(error, httpx.HTTPStatusError):
        return
    request = getattr(error, "request", None)
    if isinstance(request, httpx.Request) and normalize_path(request.url.path) != "/internal/events":
        started = request.extensions.get("elyvion_traffic_started")
        _schedule_event(_client_error_event(request, started if isinstance(started, float) else time.monotonic()))


def _schedule_event(event: dict[str, Any]) -> None:
    clean_event = {key: value for key, value in event.items() if value is not None}
    if normalize_path(clean_event.get("path", "/")) == "/internal/events":
        return
    try:
        asyncio.get_running_loop().create_task(_publish_event(clean_event))
    except RuntimeError:
        _log_delivery_warning("traffic event dropped: no active event loop")


async def _publish_event(event: dict[str, Any]) -> None:
    config = _load_ingestion_config()
    if not config:
        return
    endpoint, token = config
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.post(endpoint, json=event, headers={"x-traffic-token": token})
            response.raise_for_status()
    except httpx.HTTPError:
        _log_delivery_warning("traffic event delivery failed")


def _load_ingestion_config(
    configured_endpoint: str | None = None,
    configured_token_file: str | None = None,
    environment: str = "development",
) -> tuple[str, str] | None:
    global _config_loaded, _ingestion_config, _warning_logged
    if _config_loaded:
        return _ingestion_config
    _config_loaded = True
    endpoint = configured_endpoint or os.getenv("TRAFFIC_INGEST_URL", "http://localhost:3025/internal/events")
    token_file = configured_token_file or os.getenv("TRAFFIC_INGEST_TOKEN_FILE", "/run/secrets/traffic_ingest_token")
    try:
        token = Path(token_file).read_text(encoding="utf-8").strip()
    except OSError:
        _log_delivery_warning("traffic event delivery disabled: ingestion token file is unavailable")
        return None
    if not token:
        _log_delivery_warning("traffic event delivery disabled: ingestion token file is empty")
        return None
    try:
        url = urlsplit(endpoint)
        if (
            url.scheme not in {"http", "https"}
            or not url.netloc
            or url.username
            or url.password
            or url.query
            or url.fragment
            or url.path != "/internal/events"
            or (environment == "production" and url.scheme != "https")
        ):
            raise ValueError
    except ValueError:
        _log_delivery_warning("traffic event delivery disabled: ingestion URL is invalid")
        return None
    _ingestion_config = (endpoint, token)
    return _ingestion_config


def _log_delivery_warning(message: str) -> None:
    global _warning_logged
    if not _warning_logged:
        _warning_logged = True
        _logger.warning(message)


def _headers(raw_headers: list[tuple[bytes, bytes]]) -> dict[str, str]:
    safe_headers: dict[str, str] = {}
    for key, value in raw_headers:
        try:
            decoded_key = key.decode("latin-1").lower()
            if decoded_key in {"content-length", "x-correlation-id"}:
                safe_headers[decoded_key] = value.decode("latin-1")
        except (AttributeError, UnicodeDecodeError):
            continue
    return safe_headers


def _byte_count(value: str | None) -> int | None:
    try:
        count = int(value) if value is not None else None
    except ValueError:
        return None
    return count if count is not None and 0 <= count <= 2_147_483_647 else None


def _correlation_id(value: str | None) -> str | None:
    if not value or len(value) > 100 or not re.fullmatch(r"[\w.-]+", value):
        return None
    return value


def _service_name(host: str | None) -> str:
    if not host:
        return "unknown"
    try:
        ipaddress.ip_address(host)
        return "external"
    except ValueError:
        return host.lower()[:100]
