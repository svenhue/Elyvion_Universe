from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_route_prefix: str = "/"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"
    actions_engine_mcp_url: str = "http://localhost:3015/mcp"


settings = Settings()
