#!/usr/bin/env bash
# Blocks until the Kafka broker responds to a metadata request. Naive TCP
# checks pass before Kafka is actually able to serve the broker API, which
# causes flaky "connection refused" errors in the first producer/consumer
# to boot - this checks the real protocol via the broker's own CLI instead.
set -euo pipefail

BROKER="${KAFKA_BROKERS:-localhost:9092}"
TIMEOUT="${1:-90}"
CONTAINER="${KAFKA_CONTAINER_NAME:-saganova-kafka-1}"

echo "Waiting for Kafka broker at ${BROKER} (timeout: ${TIMEOUT}s)..."
elapsed=0
until docker exec "$CONTAINER" kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; do
  sleep 2
  elapsed=$((elapsed + 2))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "❌ Kafka did not become ready within ${TIMEOUT}s" >&2
    exit 1
  fi
done
echo "✅ Kafka is ready (${elapsed}s)"
