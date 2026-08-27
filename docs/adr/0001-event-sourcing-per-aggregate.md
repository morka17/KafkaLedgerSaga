# ADR 0001: Event Sourcing per Aggregate

**Status:** Accepted

## Context

Order, payment, and inventory each have a critical requirement in common: every state
transition must be auditable, replayable, and defensible after the fact - "why did this
order get confirmed?", "was this payment ever actually authorized, or did we imagine it?",
"did we oversell this SKU, and if so, when did the numbers stop adding up?" A
conventional CRUD model (a mutable `orders` row you `UPDATE ... SET status = ...`)
answers "what is true now" but throws away "what happened and in what order" the moment
the next update runs.

We also need optimistic concurrency control across services that all consume
Kafka's at-least-once delivery guarantee, meaning the same command can legitimately
arrive twice. A mutable row gives no natural way to detect "this is a duplicate" versus
"this is a legitimate second change."

## Decision

Every aggregate (`OrderAggregate`, `PaymentAggregate`, the inventory `StockAggregate`)
extends a shared `AggregateRoot<TState>` base class (`libs/event-sourcing-core`) that:

- Never exposes direct field mutation. State changes only through domain methods
  (`confirm()`, `cancel()`, `authorize()`, `decline()`, `refund()`, `release()`) that
  validate invariants first and then call `apply(eventType, payload)`.
- `apply()` does three things atomically in memory: runs the `when()` reducer to update
  current state, increments a version counter, and queues the event as "uncommitted."
- Persistence is a separate concern, owned by each service's `*EventStoreRepository`,
  which appends the queued events to an append-only `event_store` table under a
  `(aggregateId, sequence)` UNIQUE constraint - the actual mechanism enforcing optimistic
  concurrency. A conflicting write hits a Postgres unique-violation, which the repository
  translates into `ConcurrencyError`.
- Loading an aggregate means replaying its history (`AggregateRoot.hydrate()`), not a
  `SELECT * WHERE id = ...` - current state is always a pure function of what happened.

A denormalized read-model projection table (e.g. `order_projection`) is updated in the
**same transaction** as the event append, purely so queries don't have to replay
potentially long histories - see ADR 0003 for how that transaction also includes the
outbox write.

## Consequences

**Positive**
- Full audit trail for free - every state transition is a row in `event_store`, forever.
- Optimistic concurrency is enforced by a database constraint, not application-level
  locking, and is trivially correct under concurrent writers.
- Command handlers become naturally idempotent-friendly: replaying history and hitting
  `OrderAlreadyFinalizedError`/`ConcurrencyError` on a duplicate command is a clean signal
  to treat it as a no-op (see every `*.handler.ts` in `apps/*/src/application/commands`).

**Negative / trade-offs accepted**
- Two tables per aggregate type instead of one (`event_store` + a projection) - more
  moving parts than a single mutable table.
- Schema evolution of an event's payload shape requires care (versioned event types,
  e.g. `order.created.v1`) since old rows in `event_store` can never be rewritten.
- `inventory-service`'s `StockAggregate` is a partial exception: the no-oversell
  invariant itself is enforced by a locked plain counter table
  (`stock_level`, via `SELECT ... FOR UPDATE`), not by replaying events, because
  re-deriving "current available stock" from a full event history on every reservation
  attempt would not scale under contention. The aggregate still records the *outcome*
  of each attempt as an auditable event - see the design note at the top of
  `apps/inventory-service/src/domain/stock.aggregate.ts`.

## Alternatives Considered

- **Plain CRUD with an `updated_at`/`status` column and a separate `audit_log` table
  populated by application code.** Rejected: the audit trail and the source of truth
  would be two different things that can drift, whereas here they're the same table by
  construction.
- **Snapshotting from day one.** `libs/event-sourcing-core/src/snapshot.strategy.ts`
  exists as a ready extension point (`SnapshotStrategy`, triggered every N events) but
  is not wired into any repository yet - none of the three aggregates' histories are
  long enough in practice to need it, and adding it prematurely would be complexity
  without a measured problem.
