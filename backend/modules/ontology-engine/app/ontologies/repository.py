"""Cypher queries, one function per operation. Everything that varies
between calls goes through query parameters (`$name`), never string
interpolation — the only place a caller's value ever becomes part of the
graph is as a parameterized property value, so there's no Cypher
injection surface even though node/relationship attribute keys are
user-defined.

Node and relationship "type" (e.g. "Vehicle", "feeds_into") is stored as
a plain property, not a dynamic Neo4j label/relationship-type — labels
and relationship types *can't* be parameterized in Cypher at all, so
making them dynamic would mean string-building the query, which is
exactly the injection risk this module avoids by using one generic
`:OntologyNode` label and one generic `:RELATES_TO` relationship type
for everything, with `type` as data.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from neo4j import AsyncSession

from .schemas import (
    Ontology,
    OntologyCreate,
    OntologyEdge,
    OntologyEdgeCreate,
    OntologyEdgeUpdate,
    OntologyNode,
    OntologyNodeCreate,
    OntologyNodeUpdate,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_datetime(value: Any) -> datetime:
    """Neo4j returns its own `neo4j.time.DateTime` for temporal properties, not a stdlib `datetime` — convert it."""
    to_native = getattr(value, "to_native", None)
    return to_native() if to_native is not None else value


def _ontology_from_record(record: dict[str, Any]) -> Ontology:
    node = record["o"]
    return Ontology(
        id=node["id"],
        key=node["key"],
        name=node["name"],
        description=node.get("description"),
        type=node.get("type", "custom"),
        created_at=_to_datetime(node["createdAt"]),
        updated_at=_to_datetime(node["updatedAt"]),
    )


_RESERVED_NODE_KEYS = {"id", "ontologyKey", "type", "name", "createdAt", "updatedAt", "x", "y"}


def _node_from_record(node: dict[str, Any]) -> OntologyNode:
    attributes = {k: v for k, v in node.items() if k not in _RESERVED_NODE_KEYS}
    return OntologyNode(
        id=node["id"],
        ontology_key=node["ontologyKey"],
        type=node["type"],
        name=node["name"],
        attributes=attributes,
        x=node.get("x", 0),
        y=node.get("y", 0),
        created_at=_to_datetime(node["createdAt"]),
        updated_at=_to_datetime(node["updatedAt"]),
    )


_RESERVED_EDGE_KEYS = {"id", "ontologyKey", "type", "createdAt"}


def _edge_from_record(rel: dict[str, Any], source_id: str, target_id: str) -> OntologyEdge:
    attributes = {k: v for k, v in rel.items() if k not in _RESERVED_EDGE_KEYS}
    return OntologyEdge(
        id=rel["id"],
        ontology_key=rel["ontologyKey"],
        source_id=source_id,
        target_id=target_id,
        type=rel["type"],
        attributes=attributes,
        created_at=_to_datetime(rel["createdAt"]),
    )


# --- Ontologies ---


async def create_ontology(session: AsyncSession, payload: OntologyCreate) -> Ontology:
    now = _now()
    result = await session.run(
        "CREATE (o:Ontology {id: $id, key: $key, name: $name, description: $description, "
        "type: $type, createdAt: $now, updatedAt: $now}) RETURN o",
        id=str(uuid4()),
        key=payload.key,
        name=payload.name,
        description=payload.description,
        type=payload.type,
        now=now,
    )
    record = await result.single()
    return _ontology_from_record(dict(record))


async def list_ontologies(session: AsyncSession) -> list[Ontology]:
    result = await session.run("MATCH (o:Ontology) RETURN o ORDER BY o.name")
    return [_ontology_from_record(dict(record)) async for record in result]


async def get_ontology(session: AsyncSession, key: str) -> Ontology:
    result = await session.run("MATCH (o:Ontology {key: $key}) RETURN o", key=key)
    record = await result.single()
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Ontology "{key}" not found')
    return _ontology_from_record(dict(record))


async def delete_ontology(session: AsyncSession, key: str) -> None:
    await session.run(
        "MATCH (o:Ontology {key: $key}) "
        "OPTIONAL MATCH (n:OntologyNode {ontologyKey: $key}) "
        "DETACH DELETE o, n",
        key=key,
    )


# --- Nodes ---


async def create_node(session: AsyncSession, ontology_key: str, payload: OntologyNodeCreate) -> OntologyNode:
    await get_ontology(session, ontology_key)
    now = _now()
    # MERGE on (ontologyKey, id) rather than a plain CREATE: when the
    # caller supplies its own `id` (e.g. syncing an app schema's own
    # component ids into its ontology 1:1), calling this again with the
    # same id updates that node instead of creating a duplicate — the
    # whole point of letting an external id in, not an incidental detail.
    result = await session.run(
        "MATCH (o:Ontology {key: $ontologyKey}) "
        "MERGE (n:OntologyNode {ontologyKey: $ontologyKey, id: $id}) "
        "ON CREATE SET n.createdAt = $now "
        "SET n.type = $type, n.name = $name, n.x = $x, n.y = $y, n.updatedAt = $now "
        "SET n += $attributes "
        "RETURN n",
        ontologyKey=ontology_key,
        id=payload.id or str(uuid4()),
        type=payload.type,
        name=payload.name,
        x=payload.x,
        y=payload.y,
        now=now,
        attributes=payload.attributes,
    )
    record = await result.single()
    return _node_from_record(dict(record["n"]))


async def list_nodes(session: AsyncSession, ontology_key: str) -> list[OntologyNode]:
    result = await session.run(
        "MATCH (n:OntologyNode {ontologyKey: $ontologyKey}) RETURN n ORDER BY n.name",
        ontologyKey=ontology_key,
    )
    return [_node_from_record(dict(record["n"])) async for record in result]


async def get_node(session: AsyncSession, ontology_key: str, node_id: str) -> OntologyNode:
    result = await session.run(
        "MATCH (n:OntologyNode {ontologyKey: $ontologyKey, id: $id}) RETURN n",
        ontologyKey=ontology_key,
        id=node_id,
    )
    record = await result.single()
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Node "{node_id}" not found')
    return _node_from_record(dict(record["n"]))


async def update_node(
    session: AsyncSession, ontology_key: str, node_id: str, payload: OntologyNodeUpdate
) -> OntologyNode:
    result = await session.run(
        "MATCH (n:OntologyNode {ontologyKey: $ontologyKey, id: $id}) "
        "SET n.type = coalesce($type, n.type) "
        "SET n.name = coalesce($name, n.name) "
        "SET n.x = coalesce($x, n.x) "
        "SET n.y = coalesce($y, n.y) "
        "SET n.updatedAt = $now "
        "SET n += $attributes "
        "RETURN n",
        ontologyKey=ontology_key,
        id=node_id,
        type=payload.type,
        name=payload.name,
        x=payload.x,
        y=payload.y,
        now=_now(),
        attributes=payload.attributes or {},
    )
    record = await result.single()
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Node "{node_id}" not found')
    return _node_from_record(dict(record["n"]))


async def delete_node(session: AsyncSession, ontology_key: str, node_id: str) -> None:
    await session.run(
        "MATCH (n:OntologyNode {ontologyKey: $ontologyKey, id: $id}) DETACH DELETE n",
        ontologyKey=ontology_key,
        id=node_id,
    )


# --- Edges (relationships) ---


async def create_edge(session: AsyncSession, ontology_key: str, payload: OntologyEdgeCreate) -> OntologyEdge:
    now = _now()
    # MERGE on (source)-[type]->(target) rather than a plain CREATE: at
    # most one relationship of a given type between the same two nodes
    # makes sense for a structural sync (e.g. "contains"), so re-syncing
    # just refreshes its attributes instead of piling up duplicate edges.
    result = await session.run(
        "MATCH (a:OntologyNode {ontologyKey: $ontologyKey, id: $sourceId}) "
        "MATCH (b:OntologyNode {ontologyKey: $ontologyKey, id: $targetId}) "
        "MERGE (a)-[r:RELATES_TO {ontologyKey: $ontologyKey, type: $type}]->(b) "
        "ON CREATE SET r.id = $id, r.createdAt = $now "
        "SET r += $attributes "
        "RETURN r, a.id AS sourceId, b.id AS targetId",
        ontologyKey=ontology_key,
        sourceId=payload.source_id,
        targetId=payload.target_id,
        id=str(uuid4()),
        type=payload.type,
        now=now,
        attributes=payload.attributes,
    )
    record = await result.single()
    if record is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f'Source "{payload.source_id}" or target "{payload.target_id}" not found in this ontology.',
        )
    return _edge_from_record(dict(record["r"]), record["sourceId"], record["targetId"])


async def list_edges(session: AsyncSession, ontology_key: str) -> list[OntologyEdge]:
    result = await session.run(
        "MATCH (a:OntologyNode {ontologyKey: $ontologyKey})-[r:RELATES_TO]->(b:OntologyNode {ontologyKey: $ontologyKey}) "
        "RETURN r, a.id AS sourceId, b.id AS targetId",
        ontologyKey=ontology_key,
    )
    return [_edge_from_record(dict(record["r"]), record["sourceId"], record["targetId"]) async for record in result]


async def update_edge(
    session: AsyncSession, ontology_key: str, edge_id: str, payload: OntologyEdgeUpdate
) -> OntologyEdge:
    result = await session.run(
        "MATCH (a:OntologyNode {ontologyKey: $ontologyKey})-[r:RELATES_TO {id: $id}]->(b:OntologyNode {ontologyKey: $ontologyKey}) "
        "SET r.type = coalesce($type, r.type) "
        "SET r += $attributes "
        "RETURN r, a.id AS sourceId, b.id AS targetId",
        ontologyKey=ontology_key,
        id=edge_id,
        type=payload.type,
        attributes=payload.attributes or {},
    )
    record = await result.single()
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f'Edge "{edge_id}" not found')
    return _edge_from_record(dict(record["r"]), record["sourceId"], record["targetId"])


async def delete_edge(session: AsyncSession, ontology_key: str, edge_id: str) -> None:
    await session.run(
        "MATCH ()-[r:RELATES_TO {id: $id, ontologyKey: $ontologyKey}]->() DELETE r",
        ontologyKey=ontology_key,
        id=edge_id,
    )


# --- Convenience: the whole graph in one call, for the frontend's graph view ---


async def get_graph(session: AsyncSession, ontology_key: str) -> tuple[list[OntologyNode], list[OntologyEdge]]:
    await get_ontology(session, ontology_key)
    nodes = await list_nodes(session, ontology_key)
    edges = await list_edges(session, ontology_key)
    return nodes, edges
