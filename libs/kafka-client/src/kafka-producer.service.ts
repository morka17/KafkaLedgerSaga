import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { SaganovaKafkaOptions } from './kafka-config.factory';
import { defaultCodec, MessageCodec } from './serializers/json.serializer';

export interface PublishOptions {
  /** Kafka partition key - use the aggregateId so all events for one order stay ordered. */
  key: string;
  headers?: Record<string, string>;
}

/**
 * Thin, idempotent wrapper over the KafkaJS producer.
 *
 * - `idempotent: true` + `maxInFlightRequests: 1` guarantees exactly-once
 *   writes to a single partition, which combined with the Transactional
 *   Outbox pattern in each service prevents duplicate event publication.
 * - Every message carries the envelope's `correlationId` and `type` as
 *   Kafka headers so consumers and tracing tools can filter without
 *   deserializing the body.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly kafka: Kafka;
  private producer: Producer;

  constructor(
    private readonly options: SaganovaKafkaOptions,
    private readonly codec: MessageCodec = defaultCodec,
  ) {
    this.kafka = new Kafka({
      clientId: options.serviceName,
      brokers: options.brokers,
      ssl: options.ssl,
      sasl: options.sasl,
    });
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      transactionTimeout: 30_000,
    });
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log(`Kafka producer connected (${this.options.serviceName})`);
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish<T extends { id: string; type: string; correlationId: string }>(
    topic: string,
    envelope: T,
    opts: PublishOptions,
  ): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key: opts.key,
          value: this.codec.encode(envelope),
          headers: {
            'x-event-id': envelope.id,
            'x-event-type': envelope.type,
            'x-correlation-id': envelope.correlationId,
            ...opts.headers,
          },
        },
      ],
    });
    this.logger.debug(`Published ${envelope.type} -> ${topic} (key=${opts.key})`);
  }

  /** Publishes a batch of already-built outbox rows atomically within one producer transaction. */
  async publishBatch(
    messages: { topic: string; envelope: Record<string, unknown> & { id: string; type: string }; key: string }[],
  ): Promise<void> {
    const txn = await this.producer.transaction();
    try {
      for (const m of messages) {
        await txn.send({
          topic: m.topic,
          messages: [{ key: m.key, value: this.codec.encode(m.envelope) }],
        });
      }
      await txn.commit();
    } catch (err) {
      await txn.abort();
      throw err;
    }
  }
}
