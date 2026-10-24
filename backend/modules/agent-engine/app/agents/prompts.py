"""Editable prompts — a module can expose its own named, editable prompt
templates ("Module, die importiert werden, können auch immer Prompts
exposen"). Only this module's own planner prompt lives here today, but
the mechanism is meant to generalize the same way actions did: a module
registering one of its own rather than every prompt living in one place.
In-memory only, same trade-off as `store.py` — nothing here needs to
survive a restart yet.
"""

from dataclasses import dataclass

DEFAULT_PLANNER_SYSTEM_PROMPT = (
    "Du bist ein Planer für Multi-Agenten-Systeme. Gegeben eine Aufgabe, "
    "entwirf ein Team aus 2 bis 4 spezialisierten Agenten, die die Aufgabe "
    "nacheinander bearbeiten — jeder Agent bekommt die Aufgabe plus die "
    "Ausgabe des vorherigen Agenten und baut darauf auf. Der letzte Agent "
    "soll die endgültige Antwort liefern. Antworte ausschließlich über das "
    "Werkzeug `design_team`."
)


@dataclass
class PromptDef:
    key: str
    name: str
    description: str
    value: str


_prompts: dict[str, PromptDef] = {
    "planner_system_prompt": PromptDef(
        key="planner_system_prompt",
        name="Planer-Systemprompt",
        description="Instruiert das LLM, wie es aus einer Aufgabenbeschreibung ein Agenten-Team entwirft.",
        value=DEFAULT_PLANNER_SYSTEM_PROMPT,
    ),
}


def get(key: str) -> PromptDef | None:
    return _prompts.get(key)


def list_all() -> list[PromptDef]:
    return list(_prompts.values())


def update(key: str, value: str) -> PromptDef:
    prompt = _prompts.get(key)
    if not prompt:
        raise KeyError(key)
    prompt.value = value
    return prompt
