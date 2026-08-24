import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { INVENTORY_TOPIC, EventEnvelope, makeEvent } from '@saganova/event-contracts';

@Injectable()
export class InventoryKafkaProducer {
  private readonly logger = new Logger(InventoryKafkaProducer.name);

  constructor(private readonly producer: KafkaProducerService) {}

  async republish<T>(aggregateId: string, envelope: EventEnvelope<T>): Promise<void> {
    this.logger.warn(`Manually republishing ${envelope.type} for reservation ${aggregateId} - bypasses the outbox.`);
    await this.producer.publish(INVENTORY_TOPIC, envelope, { key: aggregateId });
  }

  buildEnvelope<T>(type: string, aggregateId: string, sequence: number, correlationId: string, payload: T) {
    return makeEvent({ type, aggregateId, sequence, correlationId, payload });
  }
}
