from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field

# Neo4j node/relationship properties must be primitives (or arrays of
# primitives) — never a nested object — so this *is* the full range of
# values an attribute can hold, not an arbitrary simplification.
AttributeValue = str | int | float | bool
Attributes = dict[str, AttributeValue]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class OntologyCreate(BaseModel):
    key: str
    name: str
    description: str | None = None
    # Which ontology *template* this is — what node/relationship `type`
    # vocabulary to expect, and (future work) what a validator checks it
    # against. Not an enum here: new types get added by callers, not by
    # editing this module. The first one, used by the Application Runner's
    # auto-sync, is "angular_app_config" (see AppOntologySyncService).
    type: str = "custom"
    # The key of the (formal) Ontology this knowledge graph's node/edge
    # types should conform to — see seed.py and GET /{key}/validate.
    # Every *other* key in this module is a knowledge graph in this sense;
    # omitted means "not validated against anything yet".
    conforms_to: str | None = None


class Ontology(BaseModel):
    id: str
    key: str
    name: str
    description: str | None = None
    type: str = "custom"
    conforms_to: str | None = None
    created_at: datetime
    updated_at: datetime


class OntologyNodeCreate(BaseModel):
    type: str
    name: str
    attributes: Attributes = Field(default_factory=dict)
    # Canvas position in the frontend graph view — purely presentational.
    x: float = 0
    y: float = 0
    # Lets a caller that owns a stable external id (e.g. a pro-code
    # component's own node id, when syncing an app's schema into its
    # ontology) use it as the ontology node's id too — then re-sync is a
    # plain upsert (see repository.create_node's MERGE) instead of ever
    # needing a separate "does this already exist" lookup.
    id: str | None = None


class OntologyNodeUpdate(BaseModel):
    type: str | None = None
    name: str | None = None
    attributes: Attributes | None = None
    """Merged into the existing attributes (added/overwritten by key), not a replacement — matches Cypher's `SET n += $attributes`."""
    x: float | None = None
    y: float | None = None


class OntologyNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    ontology_key: str
    type: str
    name: str
    attributes: Attributes = Field(default_factory=dict)
    x: float = 0
    y: float = 0
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class OntologyEdgeCreate(BaseModel):
    source_id: str
    target_id: str
    type: str
    attributes: Attributes = Field(default_factory=dict)


class OntologyEdgeUpdate(BaseModel):
    type: str | None = None
    attributes: Attributes | None = None


class OntologyEdge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    ontology_key: str
    source_id: str
    target_id: str
    type: str
    attributes: Attributes = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_now)


class OntologyGraph(BaseModel):
    nodes: list[OntologyNode]
    edges: list[OntologyEdge]


class RelationshipTypeMismatch(BaseModel):
    edge_id: str
    type: str
    expected: str
    """e.g. "Application -> UIElement" — what the Ontology declares for this relationship type."""
    actual: str
    """What the two connected nodes' own types actually are."""


class KnowledgeGraphValidationReport(BaseModel):
    ontology_key: str
    knowledge_graph_key: str
    valid: bool
    unknown_node_types: list[str] = Field(default_factory=list)
    """Node `type` values that aren't a Class defined in the Ontology."""
    unknown_relationship_types: list[str] = Field(default_factory=list)
    """Edge `type` values that aren't a relationship type defined in the Ontology."""
    relationship_type_mismatches: list[RelationshipTypeMismatch] = Field(default_factory=list)
    """Edges whose type IS defined in the Ontology, but whose actual source/target node types don't match what the Ontology declares."""
