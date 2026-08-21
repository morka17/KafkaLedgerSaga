#!/usr/bin/env bash
# Blocks until Postgres accepts connections. Used by bootstrap.sh and CI
# before migrations run, since docker compose "healthy" != "accepting
# app connections" reliably enough to skip this.
set -euo pipefail

HOST="${DB_HOST:-localhost}"
PORT="${DB_PORT:-5432}"
USER="${DB_USERNAME:-saganova}"
TIMEOUT="${1:-60}"

echo "Waiting for Postgres at ${HOST}:${PORT} (timeout: ${TIMEOUT}s)..."
elapsed=0
until pg_isready -h "$HOST" -p "$PORT" -U "$USER" > /dev/null 2>&1; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "❌ Postgres did not become ready within ${TIMEOUT}s" >&2
    exit 1
  fi
done
echo "✅ Postgres is ready (${elapsed}s)"
