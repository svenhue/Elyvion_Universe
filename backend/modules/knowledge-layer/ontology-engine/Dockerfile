# Build from the `backend/` directory so the shared package is in context:
#   docker build -f modules/knowledge-layer/ontology-engine/Dockerfile -t ontology-engine .
FROM python:3.12-slim AS base
WORKDIR /workspace/backend/modules/knowledge-layer/ontology-engine
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY packages/shared-py /workspace/backend/packages/shared-py
COPY modules/knowledge-layer/ontology-engine/pyproject.toml ./
COPY modules/knowledge-layer/ontology-engine/app ./app
RUN uv sync --no-dev
EXPOSE 8100
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
