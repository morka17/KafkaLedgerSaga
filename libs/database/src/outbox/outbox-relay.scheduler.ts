import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { OutboxAbstractRepository } from './outbox.abstract-repository';
import { OutboxRowBase } from './outbox.entity';

/**
 * Polls the outbox table every `intervalMs` and relays unpublished rows to
 * Kafka. In environments with Debezium/CDC configured, this can be disabled
 * in favor of log-based capture - the abstraction is identical either way.
 *
 * Each service registers ONE of these, injected with its own outbox repo:
 *
 *   new OutboxRelayScheduler(orderOutboxRepository, kafkaProducer)
 */
@Injectable()
export class OutboxRelayScheduler implements OnModuleInit {
  private readonly logger = new Logger(OutboxRelayScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly outboxRepository: OutboxAbstractRepository<OutboxRowBase>,
    private readonly producer: KafkaProducerService,
    private readonly intervalMs: number = 500,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    try {
      const relayed = await this.outboxRepository.relay(this.producer);
      if (relayed > 0) {
        this.logger.debug(`Relayed ${relayed} outbox row(s) to Kafka`);
      }
    } catch (err) {
      this.logger.error(`Outbox relay tick failed: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
