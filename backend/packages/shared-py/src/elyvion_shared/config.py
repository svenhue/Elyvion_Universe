from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseModuleSettings(BaseSettings):
    """Common env vars every Elyvion Python module needs. Subclass this and
    add module-specific fields instead of re-declaring these in each module."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    module_name: str
    module_base_url: str
    port: int = 8000
    registry_url: str
    auth_issuer_url: str
    environment: str = "development"
    traffic_ingest_url: str = "http://localhost:3025/internal/events"
    traffic_ingest_token_file: str = "/run/secrets/traffic_ingest_token"
