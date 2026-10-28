"""In-process run history — a plain dict, not a database. A run's whole
point is to be watched while it's live; nothing here needs to survive a
restart yet, and adding Mongo just for that isn't worth it until it is.
"""

from .schemas import RunResult

_runs: dict[str, RunResult] = {}


def save(run: RunResult) -> None:
    _runs[run.id] = run


def get(run_id: str) -> RunResult | None:
    return _runs.get(run_id)


def list_all() -> list[RunResult]:
    return sorted(_runs.values(), key=lambda run: run.created_at, reverse=True)
