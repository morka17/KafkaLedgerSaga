#!/usr/bin/env bash
# One-command local environment setup:
#   1. Install workspace deps
#   2. Start Kafka/Postgres/Jaeger via docker compose
#   3. Wait for both to actually be reachable
#   4. Provision Kafka topics
#   5. Run every service's Postgres migrations
#   6. Optionally seed dev data
#
# This is what a new engineer runs on day one and what CI runs before e2e tests.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "== 1/6  Installing dependencies =="
npm install

echo "== 2/6  Starting docker compose stack =="
docker compose up -d

echo "== 3/6  Waiting for infrastructure =="
bash tools/scripts/wait-for-postgres.sh 60
bash tools/scripts/wait-for-kafka.sh 90

echo "== 4/6  Provisioning Kafka topics =="
bash tools/scripts/create-kafka-topics.sh

echo "== 5/6  Running migrations for every service =="
npm run --workspace=@saganova/tools migrate:run-all

echo "== 6/6  Seeding local dev data =="
npm run --workspace=@saganova/tools seed

echo ""
echo "✅ Saganova local environment is up."
echo "   Kafka UI:  http://localhost:8080"
echo "   Jaeger:    http://localhost:16686"
echo "   Run 'npm run dev' to start all services."
