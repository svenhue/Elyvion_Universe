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

    # Exposes ontologies as actions — specifically so an agent can look up
    # existing "angular_app_config" ontologies as reference examples of
    # how an Elyvion application is structured before building/editing one
    # itself (app-config's add_element/update_element actions).
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="list_app_ontologies",
            name="App-Ontologien auflisten",
            description="Listet alle gespeicherten Ontologien (inkl. ihres type-Felds, z. B. angular_app_config) als Referenzbeispiele für Anwendungsstrukturen.",
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
            name="Ontologie-Graph lesen",
            description="Liest den vollständigen Graphen (Nodes + Kanten) einer Ontologie anhand ihres Keys.",
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

    # Write actions — what an agent whose job is building ontologies
    # (not just reading them for reference) actually needs.
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="create_ontology",
            name="Ontologie anlegen",
            description="Legt eine neue, leere Ontologie an (key, name, optional type).",
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
                },
                "required": ["key", "name"],
            },
        )
    )
    await register_remote_action(
        RegisterRemoteActionOptions(
            actions_engine_url=settings.actions_engine_url,
            key="add_ontology_node",
            name="Ontologie-Node hinzufügen",
            description="Fügt einer Ontologie einen neuen Node hinzu (type, name, attributes — nur Skalare, keine verschachtelten Objekte).",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/nodes",
            method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key der Ziel-Ontologie."},
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
            name="Ontologie-Kante hinzufügen",
            description="Verbindet zwei bestehende Nodes einer Ontologie mit einer gerichteten, typisierten Kante.",
            category="ontology-engine",
            module_name=settings.module_name,
            path="/ontologies/{key}/edges",
            method="POST",
            input_schema={
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key der Ziel-Ontologie."},
                    "source_id": {"type": "string"},
                    "target_id": {"type": "string"},
                    "type": {"type": "string"},
                    "attributes": {"type": "object"},
                },
                "required": ["key", "source_id", "target_id", "type"],
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
