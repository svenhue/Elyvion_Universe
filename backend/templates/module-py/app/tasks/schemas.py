from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    done: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
