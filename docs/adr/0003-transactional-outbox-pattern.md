# ADR 0003: Transactional Outbox Pattern

**Status:** Accepted

## Context

Every service that owns an aggregate needs to do two things when a command succeeds:
persist the resulting domain event to Postgres, and publish that same event to Kafka so
the rest of the system can react. These are two separate systems with no shared
transaction. Writing to Postgres and then publishing to Kafka as two sequential steps
creates a window where the process can crash between them - the event exists in the
database but was never announced, and nothing else in the system ever finds out an order
was created, a payment was authorized, or stock was reserved. This is the classic
dual-write problem, and it is not a rare edge case at the scale this system is designed
for - pod restarts, deploys, and OOM kills all produce exactly this crash window
routinely.

## Decision

No service ever publishes to Kafka directly as part of handling a command. Instead:

1. Every service's event-store repository (e.g. `OrderEventStoreRepository.save()`)
   writes the domain event to `event_store` **and** a row to that service's own
   `outbox` table (`OrderOutboxEntity`, `PaymentOutboxEntity`, etc. - all extending
   `OutboxRowBase` from `libs/database`) inside **one Postgres transaction**. Either
   both rows commit, or neither does.
2. A separate background poller (`OutboxRelayScheduler`, instantiated per-service as
   e.g. `OrderOutboxRelayService`) runs every 500ms, selects unpublished rows
   (`publishedAt IS NULL`) with `SELECT ... FOR UPDATE SKIP LOCKED` (safe for multiple
   running pod replicas to poll concurrently without double-publishing the same row),
   publishes each to Kafka via `KafkaProducerService`, and stamps `publishedAt` only
   after a successful publish.
3. If the relay crashes mid-publish, the row is simply picked up again on the next tick -
   `publishAttempts` is incremented on failure for observability, and the row is never
   dropped.

The net effect: Kafka publish becomes "eventually guaranteed," never "maybe never
happens." Publish latency is bounded by the poll interval (≤500ms typically), not
instantaneous - this system does not need sub-millisecond event propagation and happily
trades that for the correctness guarantee.

`inventory-service`'s `ReserveStockHandler` is the one place this interacts with another
transactional concern: the outbox write and the locked stock-counter decrement
(`StockRepository.reserveLinesWithinTransaction`) share the *same* transaction via
`InventoryEventStoreRepository.saveWithinTransaction()`, so "stock was actually
decremented" and "the RESERVED event was durably recorded for the outbox to relay" are
never split from each other either.

## Consequences

**Positive**
- Eliminates the dual-write problem entirely - there is no code path where a domain
  event exists in the event store but was never queued for Kafka, or vice versa.
- Publish failures (Kafka temporarily unreachable) are retried automatically by the
  relay's next tick, with no special-case error handling needed in command handlers.
- Multiple replicas of the same service can run the relay simultaneously without
  coordination beyond what Postgres's row locking already provides.

**Negative / trade-offs accepted**
- Every service carries an extra table and a polling background job, rather than a
  single `producer.send()` call.
- Introduces a small (typically sub-second) publish latency versus a direct publish.
- Outbox rows are never deleted by the relay itself (only marked `publishedAt`) - a
  retention/archival job is a deliberately separate, not-yet-built concern; see the
  comment in `OutboxAbstractRepository`.
- A subtlety worth naming: `RefundPaymentHandler` calls Stripe *before* recording the
  domain event (see its docstring), which means a crash between a successful Stripe
  refund and the DB write is NOT covered by the outbox pattern - that specific ordering
  problem (external side effect vs. internal durability) is a different, harder problem
  than the outbox solves, and is flagged as needing an ops-level reconciliation job in
  a full production build.

## Alternatives Considered

- **Change Data Capture (Debezium reading the Postgres WAL)** instead of an
  application-level polling relay. This is explicitly left as a drop-in replacement -
  `docker-compose.kafka.yml`'s comments and the outbox relay's docstring both note that
  CDC and polling are interchangeable at this abstraction boundary. Polling was chosen
  for this codebase because it requires no additional infrastructure (Debezium connector
  + Kafka Connect cluster) to get a working, correct system running locally with
  `docker compose up`.
- **Two-phase commit / distributed transactions.** Rejected outright - Kafka has no
  native 2PC participant protocol compatible with Postgres, and even where XA-style
  transactions exist between two specific systems, they trade the dual-write window for
  a coordinator-availability problem that is no easier to reason about.
