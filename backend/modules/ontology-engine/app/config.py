from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_route_prefix: str = "/"
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str


settings = Settings()
