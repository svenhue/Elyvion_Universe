"""Neo4j driver lifecycle — one process-wide async driver (it pools its own
connections internally), opened in the FastAPI lifespan and handed to
request handlers as a fresh `AsyncSession` per request via `get_session()`.

Async end-to-end (FastAPI + the async Neo4j driver) so a slow graph query
never blocks the event loop from serving other requests — the module's
whole reason to exist is fast graph reads/writes, so this isn't optional.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession

from .config import settings

_driver: AsyncDriver | None = None


async def connect() -> None:
    global _driver
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
    )
    await _driver.verify_connectivity()
    await _ensure_constraints(_driver)


async def disconnect() -> None:
    if _driver is not None:
        await _driver.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    assert _driver is not None, "Neo4j driver not initialized — connect() wasn't awaited at startup"
    async with _driver.session() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Same as `get_session`, usable outside FastAPI's `Depends` — for the environment sync's background scheduler job, which isn't handling a request."""
    assert _driver is not None, "Neo4j driver not initialized — connect() wasn't awaited at startup"
    async with _driver.session() as session:
        yield session


async def _ensure_constraints(driver: AsyncDriver) -> None:
    async with driver.session() as session:
        await session.run(
            "CREATE CONSTRAINT ontology_key IF NOT EXISTS "
            "FOR (o:Ontology) REQUIRE o.key IS UNIQUE"
        )
        await session.run(
            "CREATE CONSTRAINT ontology_node_id IF NOT EXISTS "
            "FOR (n:OntologyNode) REQUIRE n.id IS UNIQUE"
        )
        await session.run(
            "CREATE INDEX ontology_node_ontology_key IF NOT EXISTS "
            "FOR (n:OntologyNode) ON (n.ontologyKey)"
        )
        await session.run(
            "CREATE CONSTRAINT ontology_edge_id IF NOT EXISTS "
            "FOR ()-[r:RELATES_TO]-() REQUIRE r.id IS UNIQUE"
        )
