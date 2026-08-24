import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConcurrencyError, StoredEvent } from '@saganova/event-sourcing-core';
import { InventoryEventStoreEntity } from './event-store.entity';
import { StockAggregate } from '../../domain/stock.aggregate';
import { ReservationProjectionRepository } from '../postgres/reservation.repository';
import { InventoryOutboxEntity } from '../outbox/outbox.entity';
import { INVENTORY_TOPIC } from '@saganova/event-contracts';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class InventoryEventStoreRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Transaction-scoped primitive: appends events, writes outbox rows, and
   * upserts the projection using a manager the CALLER already opened.
   * This is what lets ReserveStockHandler put "lock + decrement N stock
   * rows" and "record the RESERVED event" in one atomic unit alongside
   * StockRepository.reserveLinesWithinTransaction - see reserve-stock.handler.ts.
   */
  async saveWithinTransaction(manager: EntityManager, aggregate: StockAggregate, correlationId: string): Promise<void> {
    const uncommitted = aggregate.uncommittedEvents;
    if (uncommitted.length === 0) return;

    const expectedVersion = aggregate.version - uncommitted.length;

    try {
      let sequence = expectedVersion;
      for (const evt of uncommitted) {
        sequence += 1;
        await manager.insert(InventoryEventStoreEntity, {
          aggregateId: aggregate.aggregateId,
          aggregateType: 'Reservation',
          sequence,
          type: evt.type,
          payload: evt.payload as unknown as object,
          occurredAt: evt.occurredAt,
          correlationId,
        });

        await manager.insert(InventoryOutboxEntity, {
          id: randomUUID(),
          aggregateId: aggregate.aggregateId,
          topic: INVENTORY_TOPIC,
          eventType: evt.type,
          payload: evt.payload as unknown as object,
          correlationId,
          publishedAt: null,
          publishAttempts: 0,
        });
      }

      await ReservationProjectionRepository.upsertWithinTransaction(manager, aggregate);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConcurrencyError(aggregate.aggregateId, expectedVersion);
      }
      throw err;
    }

    aggregate.markEventsAsCommitted();
  }

  /** Convenience wrapper for callers that don't need to share a transaction with anything else. */
  async save(aggregate: StockAggregate, correlationId: string): Promise<void> {
    await this.dataSource.transaction((manager) => this.saveWithinTransaction(manager, aggregate, correlationId));
  }

  async loadStream(aggregateId: string): Promise<StoredEvent[]> {
    const rows = await this.dataSource.getRepository(InventoryEventStoreEntity).find({
      where: { aggregateId },
      order: { sequence: 'ASC' },
    });

    return rows.map((r) => ({
      aggregateId: r.aggregateId,
      aggregateType: r.aggregateType,
      sequence: r.sequence,
      type: r.type,
      payload: r.payload,
      occurredAt: r.occurredAt,
      correlationId: r.correlationId,
    }));
  }

  async loadAggregate(orderId: string): Promise<StockAggregate | null> {
    const history = await this.loadStream(orderId);
    if (history.length === 0) return null;
    return StockAggregate.hydrate(StockAggregate.blank(orderId), history) as StockAggregate;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
