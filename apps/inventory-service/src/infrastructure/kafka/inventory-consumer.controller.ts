import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Consumer, Kafka } from 'kafkajs';
import {
  RESERVE_STOCK_COMMAND,
  ReserveStockCommandPayload,
  RELEASE_INVENTORY_COMMAND,
  ReleaseInventoryCommandPayload,
  SAGA_COMMANDS_TOPIC,
  CommandEnvelope,
} from '@saganova/event-contracts';
import { loadKafkaOptionsFromEnv, consumerGroupId } from '@saganova/kafka-client';
import { ReserveStockCommand, ReleaseInventoryCommand } from '../../application/commands/reserve-stock.command';

@Injectable()
export class InventoryKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryKafkaConsumer.name);
  private readonly kafka: Kafka;
  private consumer!: Consumer;

  constructor(private readonly commandBus: CommandBus) {
    const opts = loadKafkaOptionsFromEnv('inventory-service');
    this.kafka = new Kafka({
      clientId: opts.serviceName,
      brokers: opts.brokers,
      ssl: opts.ssl,
      sasl: opts.sasl,
    });
  }

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: consumerGroupId('inventory-service', 'saga-commands'),
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
          throw err;
        }

        await this.consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + BigInt(1)).toString() },
        ]);
      },
    });

    this.logger.log(`Subscribed to ${SAGA_COMMANDS_TOPIC} as group ${consumerGroupId('inventory-service', 'saga-commands')}`);
  }

  private async dispatch(envelope: CommandEnvelope<unknown>): Promise<void> {
    switch (envelope.type) {
      case RESERVE_STOCK_COMMAND: {
        const p = envelope.payload as ReserveStockCommandPayload;
        await this.commandBus.execute(new ReserveStockCommand(p.orderId, p.lines, envelope.correlationId));
        return;
      }
      case RELEASE_INVENTORY_COMMAND: {
        const p = envelope.payload as ReleaseInventoryCommandPayload;
        await this.commandBus.execute(new ReleaseInventoryCommand(p.orderId, p.reservationId, envelope.correlationId));
        return;
      }
      default:
        return;
    }
  }

  async onModuleDestroy() {
    await this.consumer?.disconnect();
  }
}
