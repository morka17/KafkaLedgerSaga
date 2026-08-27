# ADR 0004: Raw KafkaJS Consumers over NestJS's Declarative Microservice Transport

**Status:** Accepted

## Context

NestJS ships a built-in Kafka transport (`@nestjs/microservices`) with declarative
`@EventPattern()`/`@MessagePattern()` decorators - the idiomatic, lowest-effort way to
consume Kafka in a Nest application. Every consumer in this codebase
(`OrderKafkaConsumer`, `PaymentKafkaConsumer`, `InventoryKafkaConsumer`,
`SagaEventConsumer`, `NotificationKafkaConsumer`, `AuditKafkaConsumer`) instead
hand-rolls a plain `Injectable` wrapping a raw `kafkajs` `Consumer`. This needed to be a
deliberate choice, not an oversight, since it goes against the framework's own grain.

## Decision

Every Kafka consumer in this system is a plain service that connects a `kafkajs`
`Consumer` directly in `onModuleInit()`, rather than a controller decorated with
`@EventPattern()`. Three concrete requirements drove this, all present in nearly every
consumer's docstring:

1. **Manual offset commits.** Every consumer calls `consumer.run({ autoCommit: false, ... })`
   and only calls `commitOffsets()` after its command/event has been fully processed
   (persisted to Postgres, or in the audit ledger's case, successfully inserted).
   A thrown error leaves the offset uncommitted, so Kafka redelivers the exact same
   message rather than silently advancing past a failure. Nest's declarative transport
   does not expose this level of control without dropping to the same raw client
   underneath anyway.
2. **Multiple command/event types sharing one topic.** `saga.commands` alone carries
   `CreateOrder`, `ReserveStock`, `AuthorizePayment`, `ReleaseInventory`,
   `RefundPayment`, `ConfirmOrder`, and `CancelOrder` - every consumer of that topic
   inspects `envelope.type` itself and routes accordingly (see each consumer's
   `dispatch()` method), rather than relying on `@EventPattern()`'s per-message-key
   pattern matching, which is a poorer fit for "many logical message types, one
   physical topic."
3. **`audit-ledger-service`'s wildcard subscription.** `AuditKafkaConsumer` subscribes
   via a KafkaJS regex (`/^[a-z]+\.[a-z]+$/`) to pick up *any* current or future
   `<domain>.events`-shaped topic automatically. This has no equivalent in Nest's
   declarative transport, which binds a controller to specific, enumerated topics.

## Consequences

**Positive**
- Full, explicit control over delivery semantics (at-least-once, with correct
  redelivery-on-failure) in every service, rather than trusting a framework default that
  would need to be verified/overridden anyway.
- One topic can genuinely carry many logical message types without needing an
  `@EventPattern()` per type or a routing layer bolted on top of Nest's transport.
- The wildcard/regex subscription pattern the audit ledger needs is directly supported.

**Negative / trade-offs accepted**
- More boilerplate per consumer (manual `Kafka`/`Consumer` construction,
  `onModuleInit`/`onModuleDestroy` lifecycle wiring) than a one-line `@EventPattern()`
  decorator would require.
- Loses Nest's automatic integration between the microservices transport and its
  exception filters/interceptors pipeline - error handling inside `eachMessage` is
  hand-written in every consumer (`try { ... } catch (err) { log; throw; }`) rather than
  flowing through Nest's global filters.
- Every consumer duplicates the same connect/subscribe/run/commit skeleton. This
  duplication was accepted rather than abstracted into a shared base class in
  `libs/kafka-client`, because each consumer's *dispatch* logic (which command types it
  owns, what to do with each) is different enough that a shared base would mostly be
  passing callbacks around - the duplication is judged more readable than the
  abstraction would be, at the current number of consumers. This is worth revisiting if
  a fifth or sixth near-identical consumer is added.

## Alternatives Considered

- **`@nestjs/microservices`'s Kafka transport as-is**, accepting its default `eachBatch`/
  auto-commit behavior. Rejected because it does not give the manual-commit-after-success
  guarantee every consumer here depends on for correct at-least-once processing.
- **A hybrid**: use `@nestjs/microservices` for topics with exactly one message type
  (arguably `order.events`, `payment.events`, `inventory.events` each *could* fit this if
  no service needed multi-topic wildcard behavior), and raw KafkaJS only for
  `saga.commands` and the audit ledger's wildcard case. Rejected for consistency - having
  two different consumption patterns across services would cost more in "which pattern
  does this service use and why" cognitive overhead than it would save in boilerplate.
