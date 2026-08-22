import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { OrderOutboxRepository } from './outbox.repository';
import { OutboxRelayScheduler } from '@saganova/database';

/**
 * Nest-provider wrapper around the shared OutboxRelayScheduler, bound to
 * this service's own outbox repository and Kafka producer. This is what
 * turns "write an outbox row in the same DB transaction as the event
 * append" into "the row actually shows up on order.events within
 * ~500ms" without a second dual-write risk.
 */
@Injectable()
export class OrderOutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly scheduler: OutboxRelayScheduler;

  constructor(outboxRepository: OrderOutboxRepository, producer: KafkaProducerService) {
    this.scheduler = new OutboxRelayScheduler(outboxRepository, producer, 500);
  }

  onModuleInit() {
    this.scheduler.onModuleInit();
  }

  onModuleDestroy() {
    this.scheduler.onModuleDestroy();
  }
}
