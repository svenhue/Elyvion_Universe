from contextlib import asynccontextmanager

from fastapi import FastAPI

from elyvion_shared import (
    RegisterModuleOptions,
    TrafficObservabilityMiddleware,
    configure_logging,
    install_exception_handlers,
    register_module,
)

from .agents.router import router as agents_router
from .config import settings

configure_logging(
    settings.module_name,
    settings.environment,
    settings.traffic_ingest_url,
    settings.traffic_ingest_token_file,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
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


app = FastAPI(title=settings.module_name, lifespan=lifespan)
app.add_middleware(TrafficObservabilityMiddleware, module_name=settings.module_name)
install_exception_handlers(app)
app.include_router(agents_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.module_name}
