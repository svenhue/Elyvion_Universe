from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_route_prefix: str = "/"


settings = Settings()
