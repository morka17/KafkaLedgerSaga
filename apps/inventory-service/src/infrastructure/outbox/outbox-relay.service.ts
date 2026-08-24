import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { OutboxRelayScheduler } from '@saganova/database';
import { InventoryOutboxRepository } from './outbox.repository';

@Injectable()
export class InventoryOutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly scheduler: OutboxRelayScheduler;

  constructor(outboxRepository: InventoryOutboxRepository, producer: KafkaProducerService) {
    this.scheduler = new OutboxRelayScheduler(outboxRepository, producer, 500);
  }

  onModuleInit() {
    this.scheduler.onModuleInit();
  }

  onModuleDestroy() {
    this.scheduler.onModuleDestroy();
  }
}
