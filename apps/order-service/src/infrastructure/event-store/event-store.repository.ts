import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConcurrencyError, StoredEvent } from '@saganova/event-sourcing-core';
import { OrderEventStoreEntity } from './event-store.entity';
import { OrderAggregate } from '../../domain/order.aggregate';
import { OrderProjectionRepository } from '../postgres/order.repository';
import { OrderOutboxEntity } from '../outbox/outbox.entity';
import { ORDER_TOPIC } from '@saganova/event-contracts';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * The write path for every Order command handler. One call to `save()`:
 *   1. Appends every uncommitted domain event to event_store
 *   2. Upserts the read-model projection
 *   3. Writes one outbox row per event
 * ...all inside a single Postgres transaction. Either all three happen,
 * or none do - there is no window where the event store and Kafka can
 * disagree about what happened.
 */
@Injectable()
export class OrderEventStoreRepository {
  private readonly logger = new Logger(OrderEventStoreRepository.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(aggregate: OrderAggregate, correlationId: string): Promise<void> {
    const uncommitted = aggregate.uncommittedEvents;
    if (uncommitted.length === 0) return;

    const expectedVersion = aggregate.version - uncommitted.length;

    try {
      await this.dataSource.transaction(async (manager) => {
        let sequence = expectedVersion;

        for (const evt of uncommitted) {
          sequence += 1;
          // TypeORM's QueryDeepPartialEntity recursively maps object
          // types, which breaks on an open index-signature type like
          // Record<string, unknown> (a known TypeORM/TS interaction) -
          // `payload` genuinely is arbitrary JSON at this layer, so an
          // `any` cast here is the correct escape hatch, not a type-safety
          // regression.
          await manager.insert(OrderEventStoreEntity, {
            aggregateId: aggregate.aggregateId,
            aggregateType: 'Order',
            sequence,
            type: evt.type,
            payload: evt.payload as unknown as object,
            occurredAt: evt.occurredAt,
            correlationId,
          });

          await manager.insert(OrderOutboxEntity, {
            id: randomUUID(),
            aggregateId: aggregate.aggregateId,
            topic: ORDER_TOPIC,
            eventType: evt.type,
            payload: evt.payload as unknown as object,
            correlationId,
            publishedAt: null,
            publishAttempts: 0,
          });
        }

        await OrderProjectionRepository.upsertWithinTransaction(manager, aggregate);
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConcurrencyError(aggregate.aggregateId, expectedVersion);
      }
      throw err;
    }

    aggregate.markEventsAsCommitted();
  }

  async loadStream(aggregateId: string): Promise<StoredEvent[]> {
    const rows = await this.dataSource.getRepository(OrderEventStoreEntity).find({
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

  async loadAggregate(orderId: string): Promise<OrderAggregate | null> {
    const history = await this.loadStream(orderId);
    if (history.length === 0) return null;
    return OrderAggregate.hydrate(OrderAggregate.blank(orderId), history) as OrderAggregate;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
