import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { AuditLogRepository } from '../infrastructure/postgres/audit-log.repository';

interface GenericEnvelope {
  id?: string;
  type: string;
  aggregateId?: string;
  correlationId: string;
  payload: object;
}

/**
 * The one consumer in the whole system that subscribes by PATTERN
 * instead of an explicit topic list - KafkaJS supports a regex here,
 * which is what makes this a true wildcard subscription: every current
 * domain-event and command topic matches, and any FUTURE topic named
 * following the same "<domain>.events" / "saga.commands" convention is
 * picked up automatically without a code change or redeploy.
 *
 * This service only ever reads and appends - it never publishes
 * anything back onto any topic. That asymmetry is deliberate: an audit
 * trail that could feed back into the system it's auditing would be a
 * very different (and much more dangerous) kind of component.
 */
@Injectable()
export class AuditKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditKafkaConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(private readonly auditLogRepository: AuditLogRepository) {
    const opts = loadKafkaOptionsFromEnv('audit-ledger-service');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('audit-ledger-service', 'all-events'),
    });

    await this.consumer.connect();
    // Matches order.events, payment.events, inventory.events, saga.commands,
    // notifications.events - and anything future named "<word>.<word>".
    await this.consumer.subscribe({ topic: /^[a-z]+\.[a-z]+$/, fromBeginning: true });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;

        let envelope: GenericEnvelope;
        try {
          envelope = JSON.parse(message.value.toString('utf-8')) as GenericEnvelope;
        } catch {
          this.logger.warn(`Skipping unparseable message on ${topic}[${partition}]@${message.offset}`);
          await this.commit(topic, partition, message.offset);
          return;
        }

        try {
          await this.auditLogRepository.record({
            topic,
            partition,
            offset: message.offset,
            eventType: envelope.type ?? 'UNKNOWN',
            aggregateId: envelope.aggregateId,
            correlationId: envelope.correlationId ?? 'UNKNOWN',
            payload: envelope.payload ?? {},
          });
        } catch (err) {
          this.logger.error(`Failed to record audit entry for ${topic}[${partition}]@${message.offset}: ${(err as Error).message}`);
          throw err; // don't commit - redelivery will retry the write
        }

        await this.commit(topic, partition, message.offset);
      },
    });

    this.logger.log(`Subscribed to all "<domain>.<domain>" topics (wildcard) as group ${consumerGroupId('audit-ledger-service', 'all-events')}`);
  }

  private async commit(topic: string, partition: number, offset: string): Promise<void> {
    await this.consumer.commitOffsets([{ topic, partition, offset: (BigInt(offset) + BigInt(1)).toString() }]);
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
