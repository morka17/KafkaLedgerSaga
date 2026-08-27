# ADR 0002: Orchestration over Choreography for the Checkout Saga

**Status:** Accepted

## Context

Checkout spans three independent write models - order, inventory, payment - each owned
by a different service with its own database. No distributed transaction (2PC) is on
the table: it would require all three services to hold locks open across a network
round-trip, doesn't survive a service being briefly down, and Kafka gives no
transactional-commit hook across topics anyway. The Saga pattern - break the transaction
into a sequence of local transactions, each with a corresponding compensating
transaction - is the accepted alternative. The open question was *how the steps get
coordinated*: choreography (each service reacts to the previous service's event and
decides what to do next, with no central coordinator) or orchestration (one service owns
the step graph and tells every other service what to do).

## Decision

We built a dedicated orchestrator (`apps/saga-orchestrator`) that owns the entire step
graph as data (`order-fulfillment.saga-definition.ts`), persists saga progress
per-order (`saga_instance` table), and is the only service that:

- Listens across *all three* domain-event topics (`order.events`, `inventory.events`,
  `payment.events`) at once - see `SagaEventConsumer`.
- Decides what command to publish next, via `@saganova/saga-toolkit`'s
  `CompensationRegistry`, which walks the step array forward on success events and
  backward (firing each prior step's `compensationCommand`) on failure.
- Explicitly encodes "the saga is now COMPLETED/COMPENSATED" as its own local state
  transition (`SagaStateMachine.onSagaCompleted` / `onSagaCompensated`), from which it
  publishes the terminal `ConfirmOrder`/`CancelOrder` command back to order-service.

Every other service (order, inventory, payment) reacts only to commands addressed to it
on the shared `saga.commands` topic and publishes only its own domain events. None of
them know about each other or about "the saga" as a concept - `inventory-service` has no
idea payment-service exists.

## Consequences

**Positive**
- **One place to read to understand the whole business process.**
  `order-fulfillment.saga-definition.ts` is a complete, literal description of "reserve
  inventory, then authorize payment, with this specific compensation on failure" - no
  need to trace event-handler chains across three codebases to reconstruct the flow.
- **Compensation logic lives in one place** (`CompensationRegistry` + the two files in
  `apps/saga-orchestrator/src/orchestrator/compensation/`), not duplicated as
  "if I see X failed, and I'm the previous step, undo myself" logic scattered across
  every participating service.
- **Adding a step is a data change**, not a new choreography contract - insert a new
  `SagaStep` into the array with the right position, success/failure events, and
  compensation command.
- The orchestrator surviving a restart mid-saga is a solved problem: `saga_instance` is
  reloaded by `sagaId` (=`orderId`) on the next relevant event, not reconstructed from
  in-memory state.

**Negative / trade-offs accepted**
- **A new single point of coordination.** If `saga-orchestrator` is down, in-flight
  checkouts stall (though nothing is lost - Kafka retains the events, and the
  orchestrator catches up once it's back; no data corruption, only latency).
- **An extra network hop per step.** Choreography would let inventory-service publish
  directly in a way payment-service could react to; here, every step outcome round-trips
  through the orchestrator first.
- Participating services still need *some* saga-awareness: each command handler must be
  idempotent (see `OrderAlreadyFinalizedError`, `PaymentAlreadyFinalizedError`,
  `ReservationAlreadyFinalizedError` and their "treat as no-op" handling), because
  Kafka's at-least-once delivery means orchestration doesn't eliminate the need for
  idempotency, it just centralizes *deciding what to send next*.

## Alternatives Considered

- **Choreography** (each service listens to the previous step's success/failure event
  and independently decides its own next action). Rejected primarily because
  compensation logic would end up smeared across every service ("if inventory hears
  PaymentDeclined, it must know to release stock" - a payment-service concern leaking
  into inventory-service's responsibilities), and because there would be no single
  artifact describing "the checkout process" as a whole - you'd have to read every
  service's Kafka consumers to reconstruct it.
- **Hybrid** (orchestration for the happy path, choreography for cross-cutting concerns
  like notifications). This is actually what we have: `notification-service` and
  `audit-ledger-service` both choreograph off domain events independently, entirely
  outside the orchestrator's awareness - see their consumers. Full orchestration was
  reserved specifically for the steps that require compensation.
