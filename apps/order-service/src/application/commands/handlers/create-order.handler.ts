import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConcurrencyError } from '@saganova/event-sourcing-core';
import { CreateOrderCommand } from '../create-order.command';
import { OrderAggregate } from '../../../domain/order.aggregate';
import { OrderEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  private readonly logger = new Logger(CreateOrderHandler.name);

  constructor(private readonly repository: OrderEventStoreRepository) {}

  async execute(command: CreateOrderCommand): Promise<void> {
    const aggregate = OrderAggregate.createNew(command.orderId, command.customerId, command.items);

    try {
      await this.repository.save(aggregate, command.correlationId);
      this.logger.log(`Order ${command.orderId} created (customer=${command.customerId})`);
    } catch (err) {
      // A ConcurrencyError here means expectedVersion=0 didn't hold - i.e.
      // an order with this id already exists. Since CreateOrder is only
      // ever issued once per orderId by the gateway, this can only be a
      // REDELIVERED message (Kafka at-least-once) - treat it as an
      // idempotent no-op rather than crash-looping the consumer.
      if (err instanceof ConcurrencyError) {
        this.logger.warn(`CreateOrder for ${command.orderId} is a duplicate delivery - ignoring.`);
        return;
      }
      throw err;
    }
  }
}
