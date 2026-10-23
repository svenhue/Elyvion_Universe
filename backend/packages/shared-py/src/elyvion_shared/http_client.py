import httpx


def create_http_client(base_url: str | None = None) -> httpx.AsyncClient:
    """Thin httpx factory so every module configures timeouts/headers the
    same way, mirroring ElyvionHttpClient on the TypeScript side."""
    return httpx.AsyncClient(
        base_url=base_url or "",
        timeout=5.0,
        headers={"content-type": "application/json"},
    )
