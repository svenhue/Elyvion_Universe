# Build from the `backend/` directory so the shared package is in context:
#   docker build -f modules/ontology-engine/Dockerfile -t ontology-engine .
FROM python:3.12-slim AS base
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY packages/shared-py /packages/shared-py
COPY modules/ontology-engine/pyproject.toml ./
RUN uv sync --no-dev
COPY modules/ontology-engine/app ./app
EXPOSE 8100
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
