from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

LogLevel = Literal["debug", "info", "warn", "error"]
T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    data: T


class CreateLogRequest(BaseModel):
    source: str = Field(min_length=1)
    level: LogLevel = "info"
    message: str = Field(min_length=1)
    action_key: str | None = Field(default=None, alias="actionKey")
    context: dict[str, Any] | None = None

    model_config = ConfigDict(populate_by_name=True)


class LogEntryResponse(BaseModel):
    id: str
    source: str
    level: LogLevel
    message: str
    action_key: str | None = Field(alias="actionKey")
    context: dict[str, Any] | None
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class StoredFileResponse(BaseModel):
    id: str
    filename: str
    mime_type: str = Field(alias="mimeType")
    size: int

    model_config = ConfigDict(populate_by_name=True)
