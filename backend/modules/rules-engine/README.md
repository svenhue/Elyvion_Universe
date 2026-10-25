# rules-engine

Manages business rules ("Geschäftsregeln") — the "Logik" nav tab. A Rule is a named, ordered pipeline of **blocks**; each block's output feeds the next, and the first block receives the rule's own `input`.

## Why a pipeline of typed blocks, not a generic expression language

Every condition a block can express is `{field, operator, value}` — one field compared against one literal, nothing more (`condition.ts`). This mirrors `workflow-engine`'s own constrained `ConditionStep` and is a deliberate safety stance: a business user authoring a rule through the UI can't write arbitrary code, only compose a small set of well-defined operations.

## Block types

- **`filter`** — keeps only the elements of an input *array* matching a condition ("Kolumnfilter").
- **`aggregate`** — `sum`/`count`/`avg`/`min`/`max` over a field of an input array, optionally grouped by another field ("Aggregierung").
- **`decision`** — evaluated against a single input *object*: the first matching case (top to bottom) wins and its `result` is returned, else `defaultResult`. The purchasing-policy example this was built for: "ab 10.000 € muss Y freigeben, ab 5.000 € muss X freigeben, sonst kein Approval nötig."
- **`classify`** — the same ladder as `decision`, but applied to *every element* of an input array, annotating each with the matching case's result under `outputField` instead of returning one value. The customer-segmentation example this was built for: categorizing a list of entities into groups based on rules.

## Embedding a rule in a Workflow

`workflow-engine`'s `WorkflowStep` union has a new `'rule'` step type (`ruleKey` + `input`) — a rule runs exactly where an `'action'` step would, through the same `actions-engine` → `execute_rule` path. See `workflow-engine`'s README and `WorkflowRuleStep` in the frontend's `workflow-schema.ts`.

## Actions (via actions-engine)

`list_rules`, `create_rule`, `execute_rule`.

## Endpoints

`POST /rules`, `GET /rules`, `GET /rules/:key`, `PATCH /rules/:key`, `DELETE /rules/:key`, `POST /rules/:key/execute`.
