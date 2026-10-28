from pydantic import BaseModel


class EnvironmentSettings(BaseModel):
    enabled: bool = False


class EnvironmentSyncResult(BaseModel):
    nodes: int
    edges: int
