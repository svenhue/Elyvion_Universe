from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from elyvion_shared import (
    RegisterModuleOptions,
    RegisterRemoteActionOptions,
    configure_logging,
    get_logger,
    install_exception_handlers,
    register_module,
    register_remote_action,
)

from .config import settings
from .db import connect, disconnect, session_scope
from .environment import service as environment_service
from .environment.router import router as environment_router
from .ontologies.router import router as ontologies_router
from .ontologies.seed import seed_platform_ontology

configure_logging(settings.module_name, settings.environment)
logger = get_logger(__name__)

scheduler = AsyncIOScheduler()


async def _tick_environment_sync() -> None:
    async with session_scope() as session:
        current = await environment_service.get_settings(session)
        if not current.enabled:
            return
        try:
            await environment_service.sync_environment(session)
        except Exception as error:  # the tick must survive one bad sync to try again later
            logger.error("environment_sync_failed", error=str(error))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    async with session_scope() as session:
        await seed_platform_ontology(session)
    scheduler.add_job(_tick_environment_sync, "interval", seconds=30, id="environment-sync")
    scheduler.start()
    await register_module(
        RegisterModuleOptions(
            registry_url=settings.registry_url,
            name=settings.module_name,
            type="py",
            base_url=settings.module_base_url,
            route_prefix=settings.module_route_prefix,
            health_check_url=f"{settings.module_base_url}/health",
            version="0.1.0",
        )
    )

    # Exposes knowledge graphs as actions — specifically so an agent can
    # look up existing "angular_app_config" knowledge graphs as reference
    # examples of how an Elyvion application is structured before
    # building/editing one itself (app-config's add_element/update_element
    # actions). "Ontologie" in these keys/paths is this module's reserved
    # term for the formal schema (see ontologies/seed.py) — everything
    # these actions list/create/edit is a knowledge graph, instance data
    # that conforms to it.
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="list_app_ontologies",
            name="Wissensgraphen auflisten",
            description="Listet alle gespeicherten Wissensgraphen (inkl. ihres type-Felds, z. B. angular_app_config) als Referenzbeispiele für Anwendungsstrukturen.",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies",
            method="GET",
            input_schema={"type": "object", "properties": {}},
        )
    )
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="get_ontology_graph",
            name="Wissensgraph lesen",
            description="Liest den vollständigen Graphen (Nodes + Kanten) eines Wissensgraphen anhand seines Keys.",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/graph",
            method="GET",
            input_schema={
                "type": "object",
                "properties": {"key": {"type": "string"}},
                "required": ["key"],
            },
        )
    )

    # Write actions — what an agent whose job is building knowledge graphs
    # (not just reading them for reference) actually needs.
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="create_ontology",
            name="Wissensgraph anlegen",
            description="Legt einen neuen, leeren Wissensgraph an (key, name, optional type, optional conforms_to — der Key der Ontologie, gegen die er validiert werden kann).",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies",
            method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "type": {"type": "string", "description": "z. B. angular_app_config, elyvion_platform_environment, custom."},
                    "conforms_to": {"type": "string", "description": "Key der Ontologie (Standard: platform-ontology)."},
                },
                "required": ["key", "name"],
            },
        )
    )
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="add_ontology_node",
            name="Wissensgraph-Node hinzufügen",
            description="Fügt einem Wissensgraphen einen neuen Node hinzu (type, name, attributes — nur Skalare, keine verschachtelten Objekte).",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/nodes",
            method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key des Ziel-Wissensgraphen."},
                    "type": {"type": "string"},
                    "name": {"type": "string"},
                    "attributes": {"type": "object", "description": "Nur Skalare (string/number/boolean) als Werte."},
                    "id": {"type": "string", "description": "Optional — eigene Id für Upsert-Verhalten."},
                },
                "required": ["key", "type", "name"],
            },
        )
    )
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="add_ontology_edge",
            name="Wissensgraph-Kante hinzufügen",
            description="Verbindet zwei bestehende Nodes eines Wissensgraphen mit einer gerichteten, typisierten Kante.",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/edges",
            method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key des Ziel-Wissensgraphen."},
                    "source_id": {"type": "string"},
                    "target_id": {"type": "string"},
                    "type": {"type": "string"},
                    "attributes": {"type": "object"},
                },
                "required": ["key", "source_id", "target_id", "type"],
            },
        )
    )
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="validate_knowledge_graph",
            name="Wissensgraph validieren",
            description="Prüft, ob ein Wissensgraph nur Node-/Kanten-Typen verwendet, die in der (Standard: platform-ontology) Ontologie als Klasse bzw. Beziehungstyp definiert sind — ein Bericht, kein Schreibschutz.",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/validate",
            method="GET",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "against": {"type": "string", "description": "Optional — Key einer anderen Ontologie als Vergleich."},
                },
                "required": ["key"],
            },
        )
    )
    yield
    scheduler.shutdown(wait=False)
    await disconnect()


app = FastAPI(title=settings.module_name, lifespan=lifespan)
install_exception_handlers(app)
app.include_router(ontologies_router)
app.include_router(environment_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.module_name}
