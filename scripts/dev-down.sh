#!/usr/bin/env bash
#
# Stops everything ./scripts/dev-up.sh started, by PID. Infra containers
# (Postgres/Mongo/Redis/Neo4j) are left running by default — pass
# --with-infra to also run `docker compose down` on them.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.dev-run/pids"

log() { printf '\033[1;34m[dev-down]\033[0m %s\n' "$1"; }

if [ ! -f "$PID_FILE" ]; then
  log "no $PID_FILE found — nothing tracked by dev-up.sh to stop."
else
  while IFS=: read -r name pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "stopped $name (pid $pid)"
    else
      log "$name (pid $pid) was already stopped"
    fi
  done < "$PID_FILE"
  : > "$PID_FILE"
fi

if [ "${1:-}" = "--with-infra" ]; then
  log "stopping infra containers (docker compose down)…"
  (cd "$ROOT_DIR/backend" && docker compose down)
else
  log "infra containers left running — pass --with-infra to stop those too."
fi
