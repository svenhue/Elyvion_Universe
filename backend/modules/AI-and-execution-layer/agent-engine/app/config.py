from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_route_prefix: str = "/"
    local_llm_url: str = "http://localhost:3028"
    actions_engine_mcp_url: str = "http://localhost:3015/mcp"


settings = Settings()
