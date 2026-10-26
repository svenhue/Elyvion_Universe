# Build from the backend/ directory:
#   docker build -f elyvion_platform/Dockerfile -t elyvion-platform .
FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY packages/shared-py /packages/shared-py
COPY elyvion_platform/pyproject.toml elyvion_platform/uv.lock ./
RUN uv sync --no-dev
COPY elyvion_platform/app ./app
EXPOSE 3030
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3030"]
