#!/usr/bin/env bash
#
# Starts the development stack with Node.js inspectors and Python debugpy enabled.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml:$ROOT_DIR/backend/docker-compose.debug.yml"

exec "$ROOT_DIR/scripts/dev-up.sh" "$@"
