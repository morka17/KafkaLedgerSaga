import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Consumer, Kafka } from 'kafkajs';
import {
  CREATE_ORDER_COMMAND,
  CreateOrderCommandPayload,
  CONFIRM_ORDER_COMMAND,
  ConfirmOrderCommandPayload,
  CANCEL_ORDER_COMMAND,
  CancelOrderCommandPayload,
  SAGA_COMMANDS_TOPIC,
  CommandEnvelope,
} from '@saganova/event-contracts';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { CreateOrderCommand, ConfirmOrderCommand, CancelOrderCommand } from '../../application/commands/create-order.command';

/**
 * Named "*.controller.ts" to match the structure.md convention for the
 * Kafka entrypoint of a service, but implemented as a plain Injectable
 * running a raw KafkaJS consumer rather than Nest's declarative
 * @EventPattern microservice transport. That's a deliberate choice: this
 * service needs manual control over WHEN an offset commits (only after
 * the command has been durably applied) and needs to route many command
 * types that share one topic (saga.commands) by inspecting the envelope,
 * neither of which Nest's built-in Kafka strategy makes straightforward.
 *
 * Delivery semantics: `autoCommit: false` + explicit `commitOffsets`
 * after successful command execution gives at-least-once processing.
 * Every handler this dispatches to (Create/Confirm/Cancel) is written to
 * be safely re-run on redelivery - see their idempotency handling.
 */
@Injectable()
export class OrderKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderKafkaConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(private readonly commandBus: CommandBus) {
    const opts = loadKafkaOptionsFromEnv('order-service');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
    // TODO: find out why this statement wasnot included
    // this.commandBus = commandBus;
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('order-service', 'saga-commands'),
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
          this.logger.error(
            `Failed to process ${envelope.type} (id=${envelope.id}): ${(err as Error).message}`,
            (err as Error).stack,
          );
          // Do NOT commit the offset - this message will be redelivered.
          // A dead-letter topic + max-retry threshold belongs here in a
          // full production build; omitted for clarity.
          throw err;
        }

        await this.consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + BigInt(1)).toString() },
        ]);
      },
    });

    this.logger.log(`Subscribed to ${SAGA_COMMANDS_TOPIC} as group ${consumerGroupId('order-service', 'saga-commands')}`);
  }

  private async dispatch(envelope: CommandEnvelope<unknown>): Promise<void> {
    switch (envelope.type) {
      case CREATE_ORDER_COMMAND: {
        const p = envelope.payload as CreateOrderCommandPayload;
        await this.commandBus.execute(new CreateOrderCommand(p.orderId, p.customerId, p.items, envelope.correlationId));
        return;
      }
      case CONFIRM_ORDER_COMMAND: {
        const p = envelope.payload as ConfirmOrderCommandPayload;
        await this.commandBus.execute(new ConfirmOrderCommand(p.orderId, p.paymentId, envelope.correlationId));
        return;
      }
      case CANCEL_ORDER_COMMAND: {
        const p = envelope.payload as CancelOrderCommandPayload;
        await this.commandBus.execute(new CancelOrderCommand(p.orderId, p.reason, envelope.correlationId));
        return;
      }
      default:
        // Other services publish other commands on this same topic
        // (ReserveStock, AuthorizePayment, ...) - silently ignoring
        // types this service doesn't own is correct, not an error.
        return;
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
