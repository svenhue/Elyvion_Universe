#!/usr/bin/env bash
#
# Stops the development stack started with dev-debug-up.sh.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml:$ROOT_DIR/backend/docker-compose.debug.yml"

exec "$ROOT_DIR/scripts/dev-down.sh" "$@"
