import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducerService } from '@saganova/kafka-client';
import { SAGA_COMMANDS_TOPIC, makeCommand } from '@saganova/event-contracts';

/**
 * Every command the saga issues (ReserveStock, AuthorizePayment,
 * ReleaseInventory, RefundPayment, ConfirmOrder, CancelOrder) goes
 * through this one publish path, keyed by orderId so every command for
 * one checkout lands on the same partition and is processed in order by
 * whichever service owns that command type.
 */
@Injectable()
export class SagaCommandProducer {
  private readonly logger = new Logger(SagaCommandProducer.name);

  constructor(private readonly producer: KafkaProducerService) {}

  async publish(commandType: string, payload: unknown, correlationId: string): Promise<void> {
    const orderId = (payload as { orderId?: string }).orderId;
    const command = makeCommand({ type: commandType, correlationId, payload });

    await this.producer.publish(SAGA_COMMANDS_TOPIC, command, {
      key: orderId ?? command.id,
    });

    this.logger.debug(`Published ${commandType} for order ${orderId ?? '(unknown)'}`);
  }
}
