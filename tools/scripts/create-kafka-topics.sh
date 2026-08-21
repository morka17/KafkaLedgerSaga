#!/usr/bin/env bash
# Idempotently creates every topic Saganova services depend on, with
# production-reasonable partition counts and retention. Safe to re-run -
# `kafka-topics --create --if-not-exists` no-ops on existing topics.
#
# Partition counts matter here: order/payment/inventory events are keyed
# by aggregateId, so partition count is your ceiling on per-topic
# consumer parallelism. saga.commands is keyed by orderId for the same
# reason - all commands for one saga instance must stay ordered.
set -euo pipefail

CONTAINER="${KAFKA_CONTAINER_NAME:-saganova-kafka-1}"
BROKER="localhost:29092"
REPLICATION="${KAFKA_REPLICATION_FACTOR:-1}"

declare -A TOPICS=(
  ["order.events"]="6"
  ["payment.events"]="6"
  ["inventory.events"]="6"
  ["saga.commands"]="6"
  ["notifications.events"]="3"
)

declare -A RETENTION_MS=(
  ["order.events"]="604800000"          # 7 days
  ["payment.events"]="2592000000"       # 30 days (compliance-adjacent)
  ["inventory.events"]="604800000"      # 7 days
  ["saga.commands"]="259200000"         # 3 days - transient coordination traffic
  ["notifications.events"]="86400000"   # 1 day
)

echo "Creating Kafka topics on ${CONTAINER}..."

for topic in "${!TOPICS[@]}"; do
  partitions="${TOPICS[$topic]}"
  retention="${RETENTION_MS[$topic]}"

  docker exec "$CONTAINER" kafka-topics \
    --create --if-not-exists \
    --bootstrap-server "$BROKER" \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor "$REPLICATION" \
    --config "retention.ms=${retention}" \
    --config "cleanup.policy=delete"

  echo "  ✅ ${topic} (partitions=${partitions}, retention=${retention}ms)"
done

echo "Done. Current topic list:"
docker exec "$CONTAINER" kafka-topics --list --bootstrap-server "$BROKER"
