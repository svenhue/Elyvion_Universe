"""In-memory example resource — replace with a real persistence layer
(SQLAlchemy/SQLModel + Postgres) once this template is cloned for an
actual business module."""

from fastapi import APIRouter, HTTPException

from .schemas import Task, TaskCreate

router = APIRouter(prefix="/tasks", tags=["tasks"])

_tasks: dict[str, Task] = {}


@router.post("")
def create_task(payload: TaskCreate) -> Task:
    task = Task(title=payload.title)
    _tasks[task.id] = task
    return task


@router.get("")
def list_tasks() -> list[Task]:
    return list(_tasks.values())


@router.get("/{task_id}")
def get_task(task_id: str) -> Task:
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, f'Task "{task_id}" not found')
    return task


@router.patch("/{task_id}/complete")
def complete_task(task_id: str) -> Task:
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, f'Task "{task_id}" not found')
    task.done = True
    return task
