/**
 * Domain events in this service intentionally reuse the exact payload
 * shapes from @saganova/event-contracts rather than redefining local
 * "domain event" classes. The two would otherwise drift out of sync -
 * the event that gets applied to the aggregate IS the event that gets
 * published to Kafka via the outbox, so there is exactly one shape.
 */
export type { OrderCreatedPayload as OrderCreatedEventData } from '@saganova/event-contracts';
