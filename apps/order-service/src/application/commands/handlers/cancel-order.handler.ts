import { Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CancelOrderCommand } from '../create-order.command';
import { OrderAlreadyFinalizedError } from '../../../domain/order.aggregate';
import { OrderEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';

@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
  private readonly logger = new Logger(CancelOrderHandler.name);

  constructor(private readonly repository: OrderEventStoreRepository) {}

  async execute(command: CancelOrderCommand): Promise<void> {
    const aggregate = await this.repository.loadAggregate(command.orderId);
    if (!aggregate) {
      throw new NotFoundException(`Cannot cancel order ${command.orderId}: no such order.`);
    }

    try {
      aggregate.cancel(command.reason);
    } catch (err) {
      if (err instanceof OrderAlreadyFinalizedError) {
        this.logger.warn(`CancelOrder for ${command.orderId} is a duplicate delivery - ignoring.`);
        return;
      }
      throw err;
    }

    await this.repository.save(aggregate, command.correlationId);
    this.logger.log(`Order ${command.orderId} cancelled (reason=${command.reason})`);
  }
}
