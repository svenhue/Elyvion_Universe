from contextlib import asynccontextmanager

from fastapi import FastAPI

from elyvion_shared import (
    RegisterModuleOptions,
    configure_logging,
    install_exception_handlers,
    register_module,
)

from .config import settings
from .db import connect, disconnect
from .ontologies.router import router as ontologies_router

configure_logging(settings.module_name, settings.environment)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
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
    yield
    await disconnect()


app = FastAPI(title=settings.module_name, lifespan=lifespan)
install_exception_handlers(app)
app.include_router(ontologies_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.module_name}
