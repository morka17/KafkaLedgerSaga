import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ReservationLine } from '@saganova/event-contracts';
import { StockLevelEntity } from './stock-level.entity';
import { InsufficientStockError } from '../../domain/stock.aggregate';

/**
 * All methods here MUST be called with a manager that is already inside
 * an open transaction started by the caller (ReserveStockHandler /
 * ReleaseInventoryHandler) - that's what makes "lock N SKU rows, check
 * each, decrement each, and only then record the domain event" atomic
 * as a single all-or-nothing unit.
 */
@Injectable()
export class StockRepository {
  /**
   * Locks and validates every line BEFORE decrementing any of them, so a
   * failure on line 3 of 5 leaves lines 1-2 untouched inside this same
   * transaction (the transaction aborts entirely on throw - no manual
   * rollback bookkeeping needed).
   */
  async reserveLinesWithinTransaction(manager: EntityManager, lines: ReservationLine[]): Promise<void> {
    for (const line of lines) {
      const row = await manager
        .createQueryBuilder(StockLevelEntity, 's')
        .where('s.sku = :sku', { sku: line.sku })
        .setLock('pessimistic_write')
        .getOne();

      if (!row) {
        throw new InsufficientStockError(line.sku, `Unknown SKU "${line.sku}"`);
      }

      const availableToSell = row.qtyAvailable - row.qtyReserved;
      if (availableToSell < line.qty) {
        throw new InsufficientStockError(
          line.sku,
          `Requested ${line.qty} of "${line.sku}", only ${availableToSell} available`,
        );
      }
    }

    for (const line of lines) {
      await manager.increment(StockLevelEntity, { sku: line.sku }, 'qtyReserved', line.qty);
    }
  }

  async releaseLinesWithinTransaction(manager: EntityManager, lines: ReservationLine[]): Promise<void> {
    for (const line of lines) {
      await manager.decrement(StockLevelEntity, { sku: line.sku }, 'qtyReserved', line.qty);
    }
  }
}
