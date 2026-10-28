from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_route_prefix: str = "/"
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    actions_engine_url: str = "http://localhost:3015"


settings = Settings()
