#!/usr/bin/env bash
# Nukes all local build artifacts, Nx cache, and (with --volumes) the
# docker-compose Postgres volume, for a truly clean-room re-bootstrap.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Removing dist/, .nx cache, and per-app build output..."
rm -rf dist .nx/cache .nx/workspace-data
find apps libs -maxdepth 2 -type d -name "dist" -exec rm -rf {} +

if [[ "${1:-}" == "--volumes" ]]; then
  echo "Tearing down docker compose stack AND volumes (Postgres data will be lost)..."
  docker compose down --volumes
else
  echo "Stopping docker compose stack (volumes preserved - pass --volumes to wipe data)..."
  docker compose down
fi

echo "✅ Clean."
