"""
Seeds the platform's one formal Ontology — the schema every *knowledge
graph* in this module should conform to.

Three distinct layers, following the standard semantic-web split (see
module README): a **Semantic Model** is the vocabulary (what do these
business terms mean — informal, human-readable, lives in this
docstring); the **Ontology** is that vocabulary made formal — classes
and the relationship types allowed between them (the "T-Box"); a
**Knowledge Graph** is real instance data conforming to the Ontology
(the "A-Box") — what every *other* key in this module actually holds
("Transport Demo", an app's synced `angular_app_config`, the platform
environment graph, ...).

The Ontology is stored using the exact same `Ontology`/`OntologyNode`/
`OntologyEdge` primitives as any knowledge graph — a class is a node
(`type="Class"`), a relationship type is an edge between two class
nodes (`edge.type` is the relationship name itself, e.g. `"CONTAINS"`).
That reuse is deliberate: an ontology IS a graph of classes and the
relationships allowed between them, so it needs no separate storage
model, only a reserved key and a seeding routine.

Semantic Model (the vocabulary these classes formalize):
- Application: a managed Angular application, composed of UI elements.
- UIElement: one component instance within an Application (can nest).
- Entity: a data-engine entity type definition.
- Field: an attribute definition on an Entity.
- Workflow: an automated sequence of steps.
- WorkflowStep: one step within a Workflow — can itself execute an Action
  (see `WorkflowActionStep.actionKey` in the frontend's workflow-schema.ts).
- Agent: an AI actor that can execute actions/workflows.
- Action: a callable capability exposed by a module.
- DataAdapter: a configured connector to an external data source.
- DeploymentTarget: a place an Application can be deployed to.
- Deployment: one deployed instance of an Application on a DeploymentTarget.
- Role: a named set of permissions, assignable to an Agent (or a user,
  not yet its own class here) — see the `security` module.
- Permission: a grantable capability, scoped to a Resource and gating
  exactly the Action(s) that declare it as their `requiredPermission`.
- Resource: a backend module acting as a permission boundary — the thing
  that exposes Actions in the first place.
- HealthTarget: anything whose health is tracked by `telemetry` — a
  Resource (a backend module) or a Deployment, concretely.

The first version of this Ontology (14 classes, 10 relationships) left
five clusters disconnected from each other — Application/UIElement/
Deployment/DeploymentTarget; Entity/Field/DataAdapter; Workflow/
WorkflowStep; Agent/Action; Role/Permission/Resource — which doesn't
reflect the platform's real structure: these ARE connected in practice
(a workflow step runs an action; an action belongs to a resource and is
gated by a permission; a role is assigned to an agent; a UI element can
be bound to an entity; telemetry watches both resources and
deployments). The relationships added below close exactly those gaps,
so the whole Ontology is one connected graph, not five islands.
"""

from neo4j import AsyncSession

from . import repository
from .schemas import OntologyCreate, OntologyEdgeCreate, OntologyNodeCreate

PLATFORM_ONTOLOGY_KEY = "platform-ontology"

_CLASSES: dict[str, str] = {
    "Application": "A managed Angular application, composed of UI elements.",
    "UIElement": "One component instance within an Application (can nest).",
    "Entity": "A data-engine entity type definition.",
    "Field": "An attribute definition on an Entity.",
    "Workflow": "An automated sequence of steps.",
    "WorkflowStep": "One step within a Workflow.",
    "Agent": "An AI actor that can execute actions/workflows.",
    "Action": "A callable capability exposed by a module.",
    "DataAdapter": "A configured connector to an external data source.",
    "DeploymentTarget": "A place an Application can be deployed to.",
    "Deployment": "One deployed instance of an Application on a DeploymentTarget.",
    "Role": "A named set of permissions.",
    "Permission": "A grantable capability scoped to a Resource.",
    "Resource": "A backend module acting as a permission boundary.",
    "HealthTarget": "Anything whose health is tracked by telemetry — a Resource or a Deployment.",
}

# (relationship type, source class, target class, description)
_RELATIONSHIPS: list[tuple[str, str, str, str]] = [
    ("CONTAINS", "Application", "UIElement", "An Application is made up of UI elements."),
    ("CONTAINS", "UIElement", "UIElement", "A UI element can contain child UI elements."),
    ("HAS_FIELD", "Entity", "Field", "An Entity is defined by its fields."),
    ("HAS_STEP", "Workflow", "WorkflowStep", "A Workflow is made up of ordered steps."),
    ("EXECUTES", "Agent", "Action", "An Agent can execute an Action."),
    ("PRODUCES", "DataAdapter", "Entity", "A DataAdapter can populate records of an Entity."),
    ("DEPLOYS", "Deployment", "Application", "A Deployment is a running instance of an Application."),
    ("RUNS_ON", "Deployment", "DeploymentTarget", "A Deployment runs on a DeploymentTarget."),
    ("GRANTS", "Role", "Permission", "A Role grants a set of Permissions."),
    ("SCOPED_TO", "Permission", "Resource", "A Permission is scoped to one Resource."),
    # Added to connect what were five disconnected clusters — see the module docstring.
    ("EXECUTES", "WorkflowStep", "Action", "A workflow step can execute an Action by key."),
    ("EXPOSES", "Resource", "Action", "A Resource (module) exposes the Actions it implements."),
    ("GATES", "Permission", "Action", "A Permission gates exactly the Actions that declare it as required."),
    ("ASSIGNED_TO", "Role", "Agent", "A Role can be assigned to an Agent."),
    ("BINDS_TO", "UIElement", "Entity", "A UI element can be data-bound to an Entity."),
    ("MONITORED_BY", "Deployment", "HealthTarget", "A Deployment's health is tracked as a HealthTarget."),
    ("MONITORED_BY", "Resource", "HealthTarget", "A Resource's health is tracked as a HealthTarget."),
]


async def seed_platform_ontology(session: AsyncSession) -> None:
    """Idempotent — every write below is a MERGE (see repository.py), so re-running this on every boot just confirms the schema is still there instead of duplicating it."""
    try:
        await repository.get_ontology(session, PLATFORM_ONTOLOGY_KEY)
    except Exception:
        await repository.create_ontology(
            session,
            OntologyCreate(
                key=PLATFORM_ONTOLOGY_KEY,
                name="Elyvion Platform Ontology",
                description="The formal schema every knowledge graph in this environment conforms to — classes and the relationship types allowed between them.",
                type="meta_ontology",
            ),
        )

    class_node_ids: dict[str, str] = {}
    for class_name, description in _CLASSES.items():
        node = await repository.create_node(
            session,
            PLATFORM_ONTOLOGY_KEY,
            OntologyNodeCreate(
                id=f"class:{class_name}",
                type="Class",
                name=class_name,
                attributes={"description": description},
            ),
        )
        class_node_ids[class_name] = node.id

    for rel_type, source_class, target_class, description in _RELATIONSHIPS:
        await repository.create_edge(
            session,
            PLATFORM_ONTOLOGY_KEY,
            OntologyEdgeCreate(
                source_id=class_node_ids[source_class],
                target_id=class_node_ids[target_class],
                type=rel_type,
                attributes={"description": description},
            ),
        )
