FROM python:3.12-slim

WORKDIR /workspace/backend/modules/AI-and-execution-layer/agent-engine
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY packages/shared-py /workspace/backend/packages/shared-py

ARG MODULE_PATH=modules/AI-and-execution-layer/agent-engine
COPY ${MODULE_PATH}/ ./

RUN uv sync --no-dev

EXPOSE 8101
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
