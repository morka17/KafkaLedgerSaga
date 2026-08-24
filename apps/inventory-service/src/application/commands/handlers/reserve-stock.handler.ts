import { Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ReserveStockCommand } from '../reserve-stock.command';
import { StockAggregate, InsufficientStockError } from '../../../domain/stock.aggregate';
import { StockRepository } from '../../../infrastructure/postgres/stock.repository';
import { InventoryEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';
import { ReservationProjectionRepository } from '../../../infrastructure/postgres/reservation.repository';

@Injectable()
@CommandHandler(ReserveStockCommand)
export class ReserveStockHandler implements ICommandHandler<ReserveStockCommand> {
  private readonly logger = new Logger(ReserveStockHandler.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stockRepository: StockRepository,
    private readonly eventStoreRepository: InventoryEventStoreRepository,
    private readonly projectionRepository: ReservationProjectionRepository,
  ) {}

  async execute(command: ReserveStockCommand): Promise<void> {
    // Idempotency: ReserveStock can be redelivered by Kafka. If a
    // reservation already exists for this order (RESERVED or FAILED),
    // re-running the stock math would double-decrement (or double-report
    // a failure) - skip entirely.
    const existing = await this.projectionRepository.findByOrderId(command.orderId);
    if (existing) {
      this.logger.warn(`ReserveStock for order ${command.orderId} is a duplicate delivery - skipping.`);
      return;
    }

    const reservationId = randomUUID();

    try {
      // Lock + decrement every SKU row and record the RESERVED event in
      // ONE transaction: if the stock check fails partway through, the
      // whole transaction aborts and nothing is left half-decremented.
      await this.dataSource.transaction(async (manager) => {
        await this.stockRepository.reserveLinesWithinTransaction(manager, command.lines);
        const aggregate = StockAggregate.reserved(command.orderId, reservationId, command.lines);
        await this.eventStoreRepository.saveWithinTransaction(manager, aggregate, command.correlationId);
      });

      this.logger.log(`Reserved stock for order ${command.orderId} (reservation=${reservationId})`);
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        // The reservation transaction above already rolled back in full -
        // no stock was actually decremented. Recording the FAILURE is a
        // deliberately separate, independent transaction: it's a new fact
        // ("this attempt failed"), not part of the failed attempt itself.
        const failureAggregate = StockAggregate.failed(command.orderId, err.sku, err.message);
        await this.eventStoreRepository.save(failureAggregate, command.correlationId);
        this.logger.warn(`Insufficient stock for order ${command.orderId}: ${err.message}`);
        return;
      }
      throw err;
    }
  }
}
