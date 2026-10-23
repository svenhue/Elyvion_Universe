"""The "observer": mirrors the running Elyvion platform itself into an
ontology — the second ontology *type* (`"elyvion_platform_environment"`),
alongside `"angular_app_config"` (see `ontologies/repository.py`'s doc
comment on `create_node`/`create_edge` for why re-running this safely
upserts instead of duplicating).

Lives as a submodule of `ontology-engine` rather than a separate module:
observing the platform *is* graph-shaped data (environment → services,
services → each other later), so it belongs with the engine that already
knows how to store and query that shape — a dedicated "observer" module
would just be this same logic talking to this same API over HTTP instead
of calling it directly.
"""

import os

import httpx
from neo4j import AsyncSession

from ..ontologies import repository as ontologies
from ..ontologies.schemas import OntologyCreate, OntologyEdgeCreate, OntologyNodeCreate
from .schemas import EnvironmentSettings, EnvironmentSyncResult

ONTOLOGY_KEY = "platform-environment"
ROOT_NODE_ID = "env-local"
_REGISTRY_URL = os.getenv("REGISTRY_URL", "http://localhost:3010")

# No self-registration story for the Angular dev-server/static build the
# way backend modules have one with the Registry — until that exists,
# this is the explicit list of frontend apps to represent. Override with
# a comma-separated `name=baseUrl` list via FRONTEND_APPS if the platform
# grows more than the one `client` app.
_DEFAULT_FRONTEND_APPS = "client=http://localhost:4200"


def _frontend_apps() -> list[tuple[str, str]]:
    raw = os.getenv("FRONTEND_APPS", _DEFAULT_FRONTEND_APPS)
    apps = []
    for entry in raw.split(","):
        entry = entry.strip()
        if not entry or "=" not in entry:
            continue
        name, base_url = entry.split("=", 1)
        apps.append((name.strip(), base_url.strip()))
    return apps


async def get_settings(session: AsyncSession) -> EnvironmentSettings:
    result = await session.run(
        "MATCH (s:PlatformEnvironmentSettings {id: 'singleton'}) RETURN s.enabled AS enabled"
    )
    record = await result.single()
    return EnvironmentSettings(enabled=bool(record["enabled"])) if record else EnvironmentSettings()


async def set_settings(session: AsyncSession, settings: EnvironmentSettings) -> EnvironmentSettings:
    await session.run(
        "MERGE (s:PlatformEnvironmentSettings {id: 'singleton'}) SET s.enabled = $enabled",
        enabled=settings.enabled,
    )
    return settings


_COLUMN_WIDTH = 180
_ROW_HEIGHT = 150
_COLUMNS = 4


def _grid_position(index: int) -> tuple[float, float]:
    """Simple grid layout so re-syncing doesn't pile every node on top of
    the last one at (0, 0) — purely cosmetic, same as the frontend's own
    "position is presentational only" rule for a node's x/y."""
    return (index % _COLUMNS) * _COLUMN_WIDTH + 40, (index // _COLUMNS) * _ROW_HEIGHT + 150


async def sync_environment(session: AsyncSession) -> EnvironmentSyncResult:
    await _ensure_ontology(session)

    await ontologies.create_node(
        session,
        ONTOLOGY_KEY,
        OntologyNodeCreate(id=ROOT_NODE_ID, type="EnvironmentInstance", name="local", attributes={}, x=320, y=20),
    )
    node_count = 1
    edge_count = 0
    index = 0

    for name, attributes in await _backend_services():
        node_id = f"backend-{name}"
        x, y = _grid_position(index)
        index += 1
        await ontologies.create_node(
            session,
            ONTOLOGY_KEY,
            OntologyNodeCreate(id=node_id, type="BackendService", name=name, attributes=attributes, x=x, y=y),
        )
        await ontologies.create_edge(
            session, ONTOLOGY_KEY, OntologyEdgeCreate(source_id=ROOT_NODE_ID, target_id=node_id, type="contains")
        )
        node_count += 1
        edge_count += 1

    for name, base_url in _frontend_apps():
        node_id = f"frontend-{name}"
        x, y = _grid_position(index)
        index += 1
        await ontologies.create_node(
            session,
            ONTOLOGY_KEY,
            OntologyNodeCreate(id=node_id, type="FrontendApp", name=name, attributes={"baseUrl": base_url}, x=x, y=y),
        )
        await ontologies.create_edge(
            session, ONTOLOGY_KEY, OntologyEdgeCreate(source_id=ROOT_NODE_ID, target_id=node_id, type="contains")
        )
        node_count += 1
        edge_count += 1

    return EnvironmentSyncResult(nodes=node_count, edges=edge_count)


async def _ensure_ontology(session: AsyncSession) -> None:
    try:
        await ontologies.get_ontology(session, ONTOLOGY_KEY)
    except Exception:
        await ontologies.create_ontology(
            session,
            OntologyCreate(
                key=ONTOLOGY_KEY,
                name="Elyvion Platform Environment",
                type="elyvion_platform_environment",
            ),
        )


async def _backend_services() -> list[tuple[str, dict[str, object]]]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{_REGISTRY_URL}/modules")
            response.raise_for_status()
            envelope = response.json()
    except httpx.HTTPError:
        return []

    modules = envelope.get("data", envelope) if isinstance(envelope, dict) else envelope
    services: list[tuple[str, dict[str, object]]] = []
    for module in modules:
        attributes = {
            "moduleType": module.get("type", ""),
            "baseUrl": module.get("baseUrl", ""),
            "routePrefix": module.get("routePrefix", ""),
            "version": module.get("version", ""),
            "status": module.get("status", ""),
        }
        services.append((module["name"], attributes))
    return services
