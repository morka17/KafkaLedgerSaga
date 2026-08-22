import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { ORDER_TOPIC, EventEnvelope, makeEvent } from '@saganova/event-contracts';

/**
 * Direct-publish escape hatch for order.events - NOT the normal path for
 * domain events (those go through the transactional outbox, written
 * inside OrderEventStoreRepository.save()). This exists for rare,
 * explicitly-non-transactional operational needs, e.g. an admin endpoint
 * that republishes an already-committed event for a downstream consumer
 * that missed it. Using this for anything a command handler does risks
 * the exact dual-write bug the outbox pattern exists to prevent.
 */
@Injectable()
export class OrderKafkaProducer {
  private readonly logger = new Logger(OrderKafkaProducer.name);

  constructor(private readonly producer: KafkaProducerService) {}

  async republish<T>(aggregateId: string, envelope: EventEnvelope<T>): Promise<void> {
    this.logger.warn(`Manually republishing ${envelope.type} for aggregate ${aggregateId} - this bypasses the outbox.`);
    await this.producer.publish(ORDER_TOPIC, envelope, { key: aggregateId });
  }

  /** Convenience for building a well-formed envelope for the above, e.g. from an ops script. */
  buildEnvelope<T>(type: string, aggregateId: string, sequence: number, correlationId: string, payload: T) {
    return makeEvent({ type, aggregateId, sequence, correlationId, payload });
  }
}
