import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Consumer, Kafka } from 'kafkajs';
import {
  AUTHORIZE_PAYMENT_COMMAND,
  AuthorizePaymentCommandPayload,
  REFUND_PAYMENT_COMMAND,
  RefundPaymentCommandPayload,
  SAGA_COMMANDS_TOPIC,
  CommandEnvelope,
} from '@saganova/event-contracts';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { AuthorizePaymentCommand, RefundPaymentCommand } from '../../application/commands/authorize-payment.command';

/**
 * Same rationale as order-service's OrderKafkaConsumer: raw KafkaJS for
 * manual offset control + multi-command-type routing on one shared topic.
 * Every handler this dispatches to is safe to re-run on redelivery.
 */
@Injectable()
export class PaymentKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentKafkaConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(private readonly commandBus: CommandBus) {
    const opts = loadKafkaOptionsFromEnv('payment-service');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('payment-service', 'saga-commands'),
    });

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: SAGA_COMMANDS_TOPIC, fromBeginning: false });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const envelope = JSON.parse(message.value.toString('utf-8')) as CommandEnvelope<unknown>;

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

    this.logger.log(`Subscribed to ${SAGA_COMMANDS_TOPIC} as group ${consumerGroupId('payment-service', 'saga-commands')}`);
  }

  private async dispatch(envelope: CommandEnvelope<unknown>): Promise<void> {
    switch (envelope.type) {
      case AUTHORIZE_PAYMENT_COMMAND: {
        const p = envelope.payload as AuthorizePaymentCommandPayload;
        await this.commandBus.execute(
          new AuthorizePaymentCommand(p.orderId, p.customerId, p.amountCents, envelope.correlationId),
        );
        return;
      }
      case REFUND_PAYMENT_COMMAND: {
        const p = envelope.payload as RefundPaymentCommandPayload;
        await this.commandBus.execute(
          new RefundPaymentCommand(p.orderId, p.paymentId, p.amountCents, envelope.correlationId),
        );
        return;
      }
      default:
        return; // commands owned by other services on this shared topic
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
