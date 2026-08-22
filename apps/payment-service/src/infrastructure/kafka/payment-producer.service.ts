import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { PAYMENT_TOPIC, EventEnvelope, makeEvent } from '@saganova/event-contracts';

/**
 * Direct-publish escape hatch, same rationale as order-service's
 * OrderKafkaProducer - normal domain events always flow through the
 * transactional outbox, never through this class directly.
 */
@Injectable()
export class PaymentKafkaProducer {
  private readonly logger = new Logger(PaymentKafkaProducer.name);

  constructor(private readonly producer: KafkaProducerService) {}

  async republish<T>(aggregateId: string, envelope: EventEnvelope<T>): Promise<void> {
    this.logger.warn(`Manually republishing ${envelope.type} for payment ${aggregateId} - this bypasses the outbox.`);
    await this.producer.publish(PAYMENT_TOPIC, envelope, { key: aggregateId });
  }

  buildEnvelope<T>(type: string, aggregateId: string, sequence: number, correlationId: string, payload: T) {
    return makeEvent({ type, aggregateId, sequence, correlationId, payload });
  }
}
