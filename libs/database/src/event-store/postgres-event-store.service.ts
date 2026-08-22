import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConcurrencyError, EventStore, StoredEvent } from '@saganova/event-sourcing-core';
import { EventStoreRow } from './event-store.entity';

@Injectable()
export class PostgresEventStore implements EventStore {
  constructor(
    @InjectRepository(EventStoreRow)
    private readonly repo: Repository<EventStoreRow>,
  ) {}

  async append(
    aggregateId: string,
    aggregateType: string,
    events: Omit<StoredEvent, 'aggregateId' | 'aggregateType' | 'sequence'>[],
    expectedVersion: number,
  ): Promise<void> {
    const currentMax = await this.repo
      .createQueryBuilder('e')
      .select('MAX(e.sequence)', 'max')
      .where('e.aggregateId = :aggregateId', { aggregateId })
      .getRawOne<{ max: string | null }>();

    const currentVersion = currentMax?.max ? Number(currentMax.max) : 0;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyError(aggregateId, expectedVersion);
    }

    let sequence = expectedVersion;
    for (const event of events) {
      sequence += 1;
      await this.repo.insert({
        id: randomUUID(),
        aggregateId,
        aggregateType,
        sequence,
        type: event.type,
        payload: event.payload as Record<string, unknown>,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
      });
    }
  }

  async loadStream(aggregateId: string, fromSequence = 0): Promise<StoredEvent[]> {
    const rows = await this.repo.find({
      where: { aggregateId },
      order: { sequence: 'ASC' },
    });

    return rows
      .filter((row) => row.sequence > fromSequence)
      .map((row) => ({
        aggregateId: row.aggregateId,
        aggregateType: row.aggregateType,
        sequence: row.sequence,
        type: row.type,
        payload: row.payload,
        correlationId: row.correlationId,
        occurredAt: row.occurredAt,
      }));
  }
}
