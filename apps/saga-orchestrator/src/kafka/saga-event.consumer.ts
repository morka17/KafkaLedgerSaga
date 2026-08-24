import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import {
  ORDER_TOPIC,
  INVENTORY_TOPIC,
  PAYMENT_TOPIC,
  OrderEventType,
  OrderCreatedPayload,
  EventEnvelope,
} from '@saganova/event-contracts';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { SagaStateMachine } from '../orchestrator/saga-state-machine';

/**
 * The orchestrator is the one service that listens to every domain-event
 * topic (order.events, inventory.events, payment.events) instead of the
 * shared saga.commands topic other services react to - it's on the
 * receiving end of the step outcomes, not the command-issuing end, for
 * every step except the very first.
 *
 * Note: for inventory/payment events, `envelope.aggregateId` is the
 * RESERVATION's or PAYMENT's own id, not the orderId - so this always
 * reads orderId out of the event PAYLOAD instead, which every one of
 * these event types carries. See SagaStateMachine.onEvent's doc comment.
 */
@Injectable()
export class SagaEventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SagaEventConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(private readonly stateMachine: SagaStateMachine) {
    const opts = loadKafkaOptionsFromEnv('saga-orchestrator');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('saga-orchestrator', 'saga-events'),
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [ORDER_TOPIC, INVENTORY_TOPIC, PAYMENT_TOPIC], fromBeginning: false });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString('utf-8')) as EventEnvelope<Record<string, unknown>>;

        try {
          await this.dispatch(envelope);
        } catch (err) {
          this.logger.error(`Failed to process ${envelope.type} (id=${envelope.id}): ${(err as Error).message}`);
          throw err; // offset not committed -> redelivered
        }

        await this.consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + BigInt(1)).toString() },
        ]);
      },
    });

    this.logger.log(
      `Subscribed to [${ORDER_TOPIC}, ${INVENTORY_TOPIC}, ${PAYMENT_TOPIC}] as group ${consumerGroupId('saga-orchestrator', 'saga-events')}`,
    );
  }

  private async dispatch(envelope: EventEnvelope<Record<string, unknown>>): Promise<void> {
    if (envelope.type === OrderEventType.ORDER_CREATED) {
      const p = envelope.payload as unknown as OrderCreatedPayload;
      const lines = p.items.map((i) => ({ sku: i.sku, qty: i.qty }));
      await this.stateMachine.start(p.orderId, p.customerId, lines, p.totalCents, envelope.correlationId);
      return;
    }

    // Every other relevant event type (InventoryReserved/Failed,
    // PaymentAuthorized/Declined) carries orderId directly in its payload.
    // OrderConfirmed/OrderCancelled (also on order.events) carry it too,
    // but by the time those are published the saga is already
    // COMPLETED/COMPENSATED - stateMachine.onEvent's terminal-state guard
    // is what makes routing them here harmless, not a special case here.
    const orderId = envelope.payload.orderId as string | undefined;
    if (!orderId) {
      return;
    }

    await this.stateMachine.onEvent(orderId, envelope.type, envelope.correlationId, envelope.payload);
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
