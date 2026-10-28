from fastapi import APIRouter, Depends, Query
from neo4j import AsyncSession

from ..db import get_session
from . import repository
from .schemas import (
    KnowledgeGraphValidationReport,
    Ontology,
    OntologyCreate,
    OntologyEdge,
    OntologyEdgeCreate,
    OntologyEdgeUpdate,
    OntologyGraph,
    OntologyNode,
    OntologyNodeCreate,
    OntologyNodeUpdate,
)
from .seed import PLATFORM_ONTOLOGY_KEY

router = APIRouter(prefix="/ontologies", tags=["ontologies"])

Session = Depends(get_session)


@router.post("")
async def create_ontology(payload: OntologyCreate, session: AsyncSession = Session) -> Ontology:
    return await repository.create_ontology(session, payload)


@router.get("")
async def list_ontologies(session: AsyncSession = Session) -> list[Ontology]:
    return await repository.list_ontologies(session)


@router.get("/{key}")
async def get_ontology(key: str, session: AsyncSession = Session) -> Ontology:
    return await repository.get_ontology(session, key)


@router.delete("/{key}", status_code=204)
async def delete_ontology(key: str, session: AsyncSession = Session) -> None:
    await repository.delete_ontology(session, key)


@router.get("/{key}/graph")
async def get_graph(key: str, session: AsyncSession = Session) -> OntologyGraph:
    nodes, edges = await repository.get_graph(session, key)
    return OntologyGraph(nodes=nodes, edges=edges)


@router.get("/{key}/validate")
async def validate_knowledge_graph(
    key: str, against: str | None = Query(default=None), session: AsyncSession = Session
) -> KnowledgeGraphValidationReport:
    """Validates a knowledge graph's node/relationship types against a (formal) Ontology — defaults to whatever it declared via `conforms_to`, falling back to the seeded platform Ontology."""
    ontology_key = against
    if ontology_key is None:
        knowledge_graph = await repository.get_ontology(session, key)
        ontology_key = knowledge_graph.conforms_to or PLATFORM_ONTOLOGY_KEY
    return await repository.validate_knowledge_graph(session, key, ontology_key)


@router.post("/{key}/nodes")
async def create_node(key: str, payload: OntologyNodeCreate, session: AsyncSession = Session) -> OntologyNode:
    return await repository.create_node(session, key, payload)


@router.get("/{key}/nodes")
async def list_nodes(key: str, session: AsyncSession = Session) -> list[OntologyNode]:
    return await repository.list_nodes(session, key)


@router.get("/{key}/nodes/{node_id}")
async def get_node(key: str, node_id: str, session: AsyncSession = Session) -> OntologyNode:
    return await repository.get_node(session, key, node_id)


@router.patch("/{key}/nodes/{node_id}")
async def update_node(
    key: str, node_id: str, payload: OntologyNodeUpdate, session: AsyncSession = Session
) -> OntologyNode:
    return await repository.update_node(session, key, node_id, payload)


@router.delete("/{key}/nodes/{node_id}", status_code=204)
async def delete_node(key: str, node_id: str, session: AsyncSession = Session) -> None:
    await repository.delete_node(session, key, node_id)


@router.post("/{key}/edges")
async def create_edge(key: str, payload: OntologyEdgeCreate, session: AsyncSession = Session) -> OntologyEdge:
    return await repository.create_edge(session, key, payload)


@router.get("/{key}/edges")
async def list_edges(key: str, session: AsyncSession = Session) -> list[OntologyEdge]:
    return await repository.list_edges(session, key)


@router.patch("/{key}/edges/{edge_id}")
async def update_edge(
    key: str, edge_id: str, payload: OntologyEdgeUpdate, session: AsyncSession = Session
) -> OntologyEdge:
    return await repository.update_edge(session, key, edge_id, payload)


@router.delete("/{key}/edges/{edge_id}", status_code=204)
async def delete_edge(key: str, edge_id: str, session: AsyncSession = Session) -> None:
    await repository.delete_edge(session, key, edge_id)
