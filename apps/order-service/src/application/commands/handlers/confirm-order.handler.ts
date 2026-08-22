import { Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmOrderCommand } from '../create-order.command';
import { OrderAlreadyFinalizedError } from '../../../domain/order.aggregate';
import { OrderEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';

@CommandHandler(ConfirmOrderCommand)
export class ConfirmOrderHandler implements ICommandHandler<ConfirmOrderCommand> {
  private readonly logger = new Logger(ConfirmOrderHandler.name);

  constructor(private readonly repository: OrderEventStoreRepository) {}

  async execute(command: ConfirmOrderCommand): Promise<void> {
    const aggregate = await this.repository.loadAggregate(command.orderId);
    if (!aggregate) {
      // ConfirmOrder should never arrive before OrderCreated has been
      // fully processed - if it does, this is a genuine ordering bug
      // upstream (or the topic partition got reassigned mid-saga), not
      // something to silently swallow.
      throw new NotFoundException(`Cannot confirm order ${command.orderId}: no such order.`);
    }

    try {
      aggregate.confirm(command.paymentId);
    } catch (err) {
      if (err instanceof OrderAlreadyFinalizedError) {
        this.logger.warn(`ConfirmOrder for ${command.orderId} is a duplicate delivery - ignoring.`);
        return;
      }
      throw err;
    }

    await this.repository.save(aggregate, command.correlationId);
    this.logger.log(`Order ${command.orderId} confirmed (payment=${command.paymentId})`);
  }
}
