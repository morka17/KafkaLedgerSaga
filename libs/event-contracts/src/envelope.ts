/**
 * Every event and command published to Kafka is wrapped in this envelope.
 * This is what makes distributed tracing, idempotency, and schema evolution
 * possible across service boundaries.
 */
import { randomUUID } from 'crypto'

export const EVENT_ENVELOPE_VERSION = 1;

export interface EventEnvelope<TPayload = unknown> {
  /** Unique id of THIS event instance. Consumers use this for idempotency dedup. */
  id: string;
  /** Discriminator, e.g. "order.created.v1" - matches the Avro/Kafka subject name. */
  type: string;
  /** Schema version of the payload, bumped on breaking changes. */
  version: number;
  /** Id of the aggregate that produced this event (orderId, paymentId, etc). */
  aggregateId: string;
  /** Monotonically increasing sequence number within the aggregate's event stream. */
  sequence: number;
  /** ISO-8601 timestamp of when the event occurred (not when it was published). */
  occurredAt: string;
  /** Propagated across every hop of a single business transaction for tracing. */
  correlationId: string;
  /** Id of the event/command that directly caused this one, if any. */
  causationId?: string;
  /** The actual domain payload. */
  payload: TPayload;
}

export interface CommandEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  version: number;
  correlationId: string;
  causationId?: string;
  issuedAt: string;
  payload: TPayload;
}

interface EnvelopeInit<T> {
  type: string;
  aggregateId: string;
  sequence: number;
  correlationId: string;
  payload: T;
  causationId?: string;
  version?: number;
}

/** Builds a properly-formed event envelope. Use this instead of hand-rolling objects. */
export function makeEvent<T>(init: EnvelopeInit<T>): EventEnvelope<T> {
  return {
    id: randomUUID(),
    type: init.type,
    version: init.version ?? EVENT_ENVELOPE_VERSION,
    aggregateId: init.aggregateId,
    sequence: init.sequence,
    occurredAt: new Date().toISOString(),
    correlationId: init.correlationId,
    causationId: init.causationId,
    payload: init.payload,
  };
}

interface CommandInit<T> {
  type: string;
  correlationId: string;
  payload: T;
  causationId?: string;
  version?: number;
}

export function makeCommand<T>(init: CommandInit<T>): CommandEnvelope<T> {
  return {
    id: randomUUID(),
    type: init.type,
    version: init.version ?? EVENT_ENVELOPE_VERSION,
    correlationId: init.correlationId,
    causationId: init.causationId,
    issuedAt: new Date().toISOString(),
    payload: init.payload,
  };
}
