#!/usr/bin/env bash
#
# One entry point for a fresh clone: brings up the Elyvion Universe
# infrastructure, every backend module in Docker Compose, and the Angular
# client as a host development server.
#
# Deliberately a plain script, not the Deployment-Engine / Infrastructure-
# as-Code: that module builds and runs compiled artifacts against deployment
# targets. This script prepares the local development stack, runs backend
# services in containers, and tracks the host-based frontend process.
#
# Usage: ./scripts/dev-up.sh
# Stop everything again with: ./scripts/dev-down.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.dev-run"
LOG_DIR="$RUN_DIR/logs"
PID_FILE="$RUN_DIR/pids"

log() { printf '\033[1;34m[dev-up]\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[dev-up]\033[0m %s\n' "$1" >&2; exit 1; }

if [ -s "$PID_FILE" ]; then
  while IFS=: read -r name pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    if kill -0 "$pid" 2>/dev/null; then
      fail "development services appear to be running ($name, pid $pid); run ./scripts/dev-down.sh first."
    fi
  done < "$PID_FILE"
fi

mkdir -p "$LOG_DIR"
: > "$PID_FILE"

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

# --- 1. Infrastructure containers ---

log "starting infrastructure containers (Docker Compose)…"
(cd "$ROOT_DIR/backend" && docker compose up -d postgres adminer mongo redis neo4j ollama)

log "waiting for the Compose PostgreSQL database and Neo4j…"
for i in $(seq 1 60); do
  pg_ok=$(docker inspect -f '{{.State.Health.Status}}' elyvion-postgres 2>/dev/null || echo "starting")
  neo_ok=$(docker inspect -f '{{.State.Health.Status}}' elyvion-neo4j 2>/dev/null || echo "starting")
  [ "$pg_ok" = "healthy" ] && [ "$neo_ok" = "healthy" ] && break
  sleep 2
done
[ "$pg_ok" = "healthy" ] || fail "Compose PostgreSQL did not report healthy after 120s; refusing to run database migrations."
[ "$neo_ok" = "healthy" ] || log "warning: Neo4j did not report healthy after 120s — continuing anyway, ontology-engine may fail to connect."

# --- 2. Backend: env files, dependencies, Prisma migrations ---

log "ensuring every backend module has a .env (copied from .env.example where missing)…"
for module_dir in "$ROOT_DIR"/backend/modules/*/ "$ROOT_DIR"/backend/modules/*/*/ "$ROOT_DIR"/backend/elyvion_platform/; do
  module_dir="${module_dir%/}"
  if [ -f "$module_dir/.env.example" ] && [ ! -f "$module_dir/.env" ]; then
    cp "$module_dir/.env.example" "$module_dir/.env"
    log "  created $(basename "$module_dir")/.env"
  fi
done

ensure_secret_file() {
  local secret_path="$1"
  if [ ! -s "$secret_path" ]; then
    mkdir -p "$(dirname "$secret_path")"
    node - "$secret_path" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = process.argv[2];
try {
  fs.writeFileSync(path, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
NODE
  fi
  chmod 600 "$secret_path"
}

log "ensuring local-only runtime credentials exist as protected files…"
ensure_secret_file "$ROOT_DIR/backend/.secrets/traffic_ingest_token"
ensure_secret_file "$ROOT_DIR/backend/.secrets/local_llm_service_token"
ensure_secret_file "$ROOT_DIR/backend/.secrets/workflow_task_token"

log "checking host-run database URLs use the Compose PostgreSQL port (5433)…"
for module_dir in "$ROOT_DIR"/backend/modules/*/ "$ROOT_DIR"/backend/modules/*/*/ "$ROOT_DIR"/backend/elyvion_platform/; do
  module_dir="${module_dir%/}"
  env_file="$module_dir/.env"
  [ -f "$env_file" ] || continue
  if grep -Eq '^DATABASE_URL=.*@(localhost|127\.0\.0\.1):5432/' "$env_file"; then
    fail "$env_file still points to host PostgreSQL on port 5432; use the Compose database on port 5433."
  fi
done

log "installing backend (pnpm workspace) dependencies…"
(cd "$ROOT_DIR/backend" && pnpm install)

PRISMA_MODULE_PATHS=(registry AI-and-execution-layer/workflow-engine logging security-layer/security observability/telemetry observability/traffic)
for module_path in "${PRISMA_MODULE_PATHS[@]}"; do
  module_name="$(basename "$module_path")"
  module_dir="$ROOT_DIR/backend/modules/$module_path"
  [ -d "$module_dir/prisma" ] || continue
  log "applying Prisma migrations for $module_name…"
  (cd "$module_dir" && npx prisma migrate deploy && npx prisma generate) \
    || fail "Prisma migration failed for $module_name — check $module_dir/.env's DATABASE_URL."
done

log "building all backend service images…"
(cd "$ROOT_DIR/backend" && docker compose --parallel 4 build) \
  || fail "One or more backend service images failed to build."

log "starting all backend services as Docker Compose containers…"
(cd "$ROOT_DIR/backend" && docker compose up -d) \
  || fail "One or more backend services failed to start."

BACKEND_SERVICES=(
  registry security auth gateway actions-engine app-config chat data-adapters data-engine
  deployment-engine integrations local-llm repository rules-engine solutions telemetry traffic
  version-control workflow-engine agent-engine ontology-engine elyvion-platform
)
for service in "${BACKEND_SERVICES[@]}"; do
  container_id=$(cd "$ROOT_DIR/backend" && docker compose ps -q "$service")
  [ -n "$container_id" ] || fail "$service container was not created."
  healthy=false
  for i in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "starting")
    if [ "$status" = "healthy" ]; then
      healthy=true
      break
    fi
    if [ "$status" = "unhealthy" ]; then
      break
    fi
    sleep 2
  done
  [ "$healthy" = true ] || fail "$service did not become healthy; inspect it with docker compose logs $service."
done

# --- 3. Start the frontend development server ---
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
log "  PostgreSQL host port: 5433 (Compose service: postgres:5432)"
log "  Neo4j Browser:      http://localhost:7474"
log ""
log "Frontend log: ${LOG_DIR#"$ROOT_DIR"/}/client.log   PIDs: ${PID_FILE#"$ROOT_DIR"/}"
log "Backend logs: (cd backend && docker compose logs -f <service>)"
log "Stop everything with: ./scripts/dev-down.sh"
