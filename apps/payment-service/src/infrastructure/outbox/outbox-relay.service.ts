import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { OutboxRelayScheduler } from '@saganova/database';
import { PaymentOutboxRepository } from './outbox.repository';

@Injectable()
export class PaymentOutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly scheduler: OutboxRelayScheduler;

  constructor(outboxRepository: PaymentOutboxRepository, producer: KafkaProducerService) {
    this.scheduler = new OutboxRelayScheduler(outboxRepository, producer, 500);
  }

  onModuleInit() {
    this.scheduler.onModuleInit();
  }

  onModuleDestroy() {
    this.scheduler.onModuleDestroy();
  }
}
