import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConcurrencyError, StoredEvent } from '@saganova/event-sourcing-core';
import { PaymentEventStoreEntity } from './event-store.entity';
import { PaymentAggregate } from '../../domain/payment.aggregate';
import { PaymentProjectionRepository } from '../postgres/payment.repository';
import { PaymentOutboxEntity } from '../outbox/outbox.entity';
import { PAYMENT_TOPIC } from '@saganova/event-contracts';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class PaymentEventStoreRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async save(aggregate: PaymentAggregate, correlationId: string): Promise<void> {
    const uncommitted = aggregate.uncommittedEvents;
    if (uncommitted.length === 0) return;

    const expectedVersion = aggregate.version - uncommitted.length;

    try {
      await this.dataSource.transaction(async (manager) => {
        let sequence = expectedVersion;

        for (const evt of uncommitted) {
          sequence += 1;
          await manager.insert(PaymentEventStoreEntity, {
            aggregateId: aggregate.aggregateId,
            aggregateType: 'Payment',
            sequence,
            type: evt.type,
            payload: evt.payload as unknown as object,
            occurredAt: evt.occurredAt,
            correlationId,
          });

          await manager.insert(PaymentOutboxEntity, {
            id: randomUUID(),
            aggregateId: aggregate.aggregateId,
            topic: PAYMENT_TOPIC,
            eventType: evt.type,
            payload: evt.payload as unknown as object,
            correlationId,
            publishedAt: null,
            publishAttempts: 0,
          });
        }

        await PaymentProjectionRepository.upsertWithinTransaction(manager, aggregate);
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
    const rows = await this.dataSource.getRepository(PaymentEventStoreEntity).find({
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

  async loadAggregate(paymentId: string): Promise<PaymentAggregate | null> {
    const history = await this.loadStream(paymentId);
    if (history.length === 0) return null;
    return PaymentAggregate.hydrate(PaymentAggregate.blank(paymentId), history) as PaymentAggregate;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }
}
