from elyvion_shared import BaseModuleSettings


class Settings(BaseModuleSettings):
    module_name: str = "elyvion_platform"
    module_base_url: str = "http://localhost:3030"
    port: int = 3030
    registry_url: str = "http://localhost:3010"
    auth_issuer_url: str = "http://localhost:3011"
    database_url: str = "postgresql://elyvion:elyvion@localhost:5432/elyvion"
    mongodb_uri: str = "mongodb://localhost:27017/elyvion_files"


settings = Settings()
