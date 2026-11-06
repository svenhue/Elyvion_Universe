import httpx

from .traffic import create_traffic_httpx_hooks


def create_http_client(base_url: str | None = None, timeout: float = 5.0) -> httpx.AsyncClient:
    """Thin httpx factory so every module configures timeouts/headers the
    same way, mirroring ElyvionHttpClient on the TypeScript side."""
    return httpx.AsyncClient(
        base_url=base_url or "",
        timeout=timeout,
        headers={"content-type": "application/json"},
        event_hooks=create_traffic_httpx_hooks(),
    )
