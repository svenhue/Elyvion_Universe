#!/usr/bin/env bash
#
# One entry point for a fresh clone: brings up every piece of the Elyvion
# Universe platform locally — infra containers, every backend module
# (TypeScript via Turborepo + Python via uvicorn), and the Angular client.
#
# Deliberately a plain script, not the Deployment-Engine / Infrastructure-
# as-Code: that module builds and runs a *compiled* artifact against a
# target (local Docker today, a cloud provider later) — it has nothing to
# do with orchestrating this repo's own source-level dev services with
# hot-reload. This script is the dev-time equivalent of what a human was
# doing by hand all session: start infra, install deps, run migrations,
# start every module in the background, track its PID.
#
# Usage: ./scripts/dev-up.sh
# Stop everything again with: ./scripts/dev-down.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev-run"
LOG_DIR="$RUN_DIR/logs"
PID_FILE="$RUN_DIR/pids"

mkdir -p "$LOG_DIR"
: > "$PID_FILE"

log() { printf '\033[1;34m[dev-up]\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[dev-up]\033[0m %s\n' "$1" >&2; exit 1; }

track() {
  # track <name> <pid>
  echo "$1:$2" >> "$PID_FILE"
}

start_bg() {
  # start_bg <name> <log-file> <command...> — runs in the given cwd (caller already cd'd)
  local name="$1" logfile="$2"
  shift 2
  nohup "$@" > "$logfile" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  track "$name" "$pid"
  log "started $name (pid $pid, log: ${logfile#"$ROOT_DIR"/})"
}

# --- 0. Prerequisites ---

for bin in docker node pnpm npm; do
  command -v "$bin" >/dev/null 2>&1 || fail "\"$bin\" is required but not found on PATH. Install it and re-run."
done

# `uv`'s own binary isn't always on PATH even when it's installed (e.g. as
# a pip package without its console-script shim) — `python3 -m uv` works
# in that case, so fall back to it instead of hard-failing.
if command -v uv >/dev/null 2>&1; then
  UV=(uv)
elif python3 -m uv --version >/dev/null 2>&1; then
  UV=(python3 -m uv)
else
  fail "\"uv\" is required (https://docs.astral.sh/uv/) but not found on PATH, not even via \"python3 -m uv\". Install it and re-run."
fi

# --- 1. Infra containers (Postgres, Mongo, Redis, Neo4j) ---

log "starting infra containers (docker compose)…"
(cd "$ROOT_DIR/backend" && docker compose up -d)

log "waiting for Postgres and Neo4j health checks…"
for i in $(seq 1 60); do
  pg_ok=$(docker inspect -f '{{.State.Health.Status}}' elyvion-postgres 2>/dev/null || echo "starting")
  neo_ok=$(docker inspect -f '{{.State.Health.Status}}' elyvion-neo4j 2>/dev/null || echo "starting")
  [ "$pg_ok" = "healthy" ] && [ "$neo_ok" = "healthy" ] && break
  sleep 2
done
[ "$pg_ok" = "healthy" ] || log "warning: Postgres did not report healthy after 120s — continuing anyway, migrations may fail."
[ "$neo_ok" = "healthy" ] || log "warning: Neo4j did not report healthy after 120s — continuing anyway, ontology-engine may fail to connect."

# --- 2. Backend: env files, dependencies, Prisma migrations ---

log "ensuring every backend module has a .env (copied from .env.example where missing)…"
for module_dir in "$ROOT_DIR"/backend/modules/*/; do
  module_dir="${module_dir%/}"
  if [ -f "$module_dir/.env.example" ] && [ ! -f "$module_dir/.env" ]; then
    cp "$module_dir/.env.example" "$module_dir/.env"
    log "  created $(basename "$module_dir")/.env"
  fi
done

log "installing backend (pnpm workspace) dependencies…"
(cd "$ROOT_DIR/backend" && pnpm install)

PRISMA_MODULES=(registry users workflow-engine logging security telemetry)
for module in "${PRISMA_MODULES[@]}"; do
  module_dir="$ROOT_DIR/backend/modules/$module"
  [ -d "$module_dir/prisma" ] || continue
  log "applying Prisma migrations for $module…"
  (cd "$module_dir" && npx prisma migrate deploy && npx prisma generate) \
    || fail "Prisma migration failed for $module — check $module_dir/.env's DATABASE_URL."
done

log "syncing Python module dependencies (uv)…"
for module in agent-engine ontology-engine; do
  module_dir="$ROOT_DIR/backend/modules/$module"
  (cd "$module_dir" && "${UV[@]}" sync) || fail "uv sync failed for $module."
done

# --- 3. Start everything ---

log "starting all TypeScript backend modules (pnpm dev, via Turborepo)…"
(cd "$ROOT_DIR/backend" && start_bg "backend-ts" "$LOG_DIR/backend-ts.log" pnpm dev)

for module in agent-engine ontology-engine; do
  module_dir="$ROOT_DIR/backend/modules/$module"
  port=$(grep -h '^PORT=' "$module_dir/.env" | head -1 | cut -d= -f2)
  (cd "$module_dir" && start_bg "$module" "$LOG_DIR/$module.log" "${UV[@]}" run uvicorn app.main:app --reload --port "$port")
done

log "building the shared Angular library once before serving the client…"
(cd "$ROOT_DIR/frontend" && npm install && npm run build:lib) \
  || fail "Frontend dependency install / shared-lib build failed."

log "starting the Angular client dev server…"
(cd "$ROOT_DIR/frontend" && start_bg "client" "$LOG_DIR/client.log" npx ng serve client)

log ""
log "Everything is starting. Give the backend ~15-20s to finish registering with the Registry."
log ""
log "  Client app:       http://localhost:4200"
log "  Gateway (API):     http://localhost:3000"
log "  Registry:          http://localhost:3010/modules"
log "  Adminer (Postgres): http://localhost:8081"
log "  Neo4j Browser:      http://localhost:7474"
log ""
log "Logs: ${LOG_DIR#"$ROOT_DIR"/}/<name>.log   PIDs: ${PID_FILE#"$ROOT_DIR"/}"
log "Stop everything with: ./scripts/dev-down.sh"
