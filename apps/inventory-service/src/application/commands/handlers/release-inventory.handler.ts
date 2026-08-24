import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReleaseInventoryCommand } from '../reserve-stock.command';
import { ReservationAlreadyFinalizedError } from '../../../domain/stock.aggregate';
import { StockRepository } from '../../../infrastructure/postgres/stock.repository';
import { InventoryEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';

/** The compensating handler: fired when payment is declined after inventory was already reserved. */
@Injectable()
@CommandHandler(ReleaseInventoryCommand)
export class ReleaseInventoryHandler implements ICommandHandler<ReleaseInventoryCommand> {
  private readonly logger = new Logger(ReleaseInventoryHandler.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stockRepository: StockRepository,
    private readonly eventStoreRepository: InventoryEventStoreRepository,
  ) {}

  async execute(command: ReleaseInventoryCommand): Promise<void> {
    const aggregate = await this.eventStoreRepository.loadAggregate(command.orderId);
    if (!aggregate) {
      throw new NotFoundException(`Cannot release inventory for order ${command.orderId}: no such reservation.`);
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.stockRepository.releaseLinesWithinTransaction(manager, aggregate.snapshot.lines);
        aggregate.release(); // throws ReservationAlreadyFinalizedError if not currently RESERVED
        await this.eventStoreRepository.saveWithinTransaction(manager, aggregate, command.correlationId);
      });
    } catch (err) {
      if (err instanceof ReservationAlreadyFinalizedError) {
        this.logger.warn(`ReleaseInventory for order ${command.orderId} is a duplicate delivery - ignoring.`);
        return;
      }
      throw err;
    }

    this.logger.log(`Released inventory for order ${command.orderId}`);
  }
}
