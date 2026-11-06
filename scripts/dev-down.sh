#!/usr/bin/env bash
#
# Stops the frontend process tracked by dev-up.sh and all backend
# application containers. Infrastructure containers remain running by default.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.dev-run/pids"

log() { printf '\033[1;34m[dev-down]\033[0m %s\n' "$1"; }

if [ "${1:-}" != "" ] && [ "${1:-}" != "--with-infra" ]; then
  printf 'Usage: %s [--with-infra]\n' "$0" >&2
  exit 2
fi

if [ ! -f "$PID_FILE" ]; then
  log "no $PID_FILE found — nothing tracked by dev-up.sh to stop."
else
  while IFS=: read -r name pid; do
    [ -z "$pid" ] && continue
    if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
      log "ignoring invalid PID for $name"
      continue
    fi
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "stopped $name (pid $pid)"
    else
      log "$name (pid $pid) was already stopped"
    fi
  done < "$PID_FILE"
  : > "$PID_FILE"
fi

log "stopping backend application containers…"
(cd "$ROOT_DIR/backend" && docker compose stop \
  auth security registry gateway actions-engine app-config chat data-adapters data-engine \
  deployment-engine integrations local-llm repository rules-engine solutions telemetry traffic \
  version-control workflow-engine agent-engine ontology-engine elyvion-platform) \
  || { log "failed to stop backend application containers."; exit 1; }

if [ "${1:-}" = "--with-infra" ]; then
  log "stopping Compose containers (volumes and database data are preserved)…"
  (cd "$ROOT_DIR/backend" && docker compose down)
else
  log "infra containers left running — pass --with-infra to stop those too."
fi
