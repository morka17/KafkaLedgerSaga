import { Logger } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { KafkaProducerService } from '@saganova/kafka-client';
import { OutboxRowBase } from './outbox.entity';

/**
 * Generic Transactional Outbox implementation shared by every service.
 *
 * `writeWithinTransaction` is called from inside the SAME `manager.transaction()`
 * block that persists the aggregate's event-store rows, so either both the
 * domain event AND the outbox row commit, or neither does - solving the
 * classic "wrote to DB but crashed before publishing to Kafka" dual-write bug.
 *
 * `relay()` is invoked on a fixed interval (see OutboxRelayService below) and
 * is safe to run on multiple instances concurrently thanks to `FOR UPDATE SKIP LOCKED`.
 */
export abstract class OutboxAbstractRepository<TRow extends OutboxRowBase> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly repo: Repository<TRow>) {}

  async writeWithinTransaction(
    manager: EntityManager,
    row: Omit<TRow, 'createdAt' | 'publishedAt' | 'publishAttempts'>,
  ): Promise<void> {
    await manager.insert(this.repo.target, {
      ...row,
      publishedAt: null,
      publishAttempts: 0,
    } as never);
  }

  async relay(producer: KafkaProducerService, batchSize = 100): Promise<number> {
    return this.repo.manager.transaction(async (manager) => {
      const rows: TRow[] = await manager
        .createQueryBuilder(this.repo.target, 'o')
        .where('o.publishedAt IS NULL')
        .orderBy('o.createdAt', 'ASC')
        .limit(batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked') // lets multiple pod replicas relay concurrently, safely
        .getMany();

      if (rows.length === 0) return 0;

      for (const row of rows) {
        try {
          await producer.publish(
            row.topic,
            {
              id: row.id,
              type: row.eventType,
              correlationId: row.correlationId,
              aggregateId: row.aggregateId,
              payload: row.payload,
            },
            { key: row.aggregateId },
          );

          await manager.update(this.repo.target, row.id, {
            publishedAt: new Date(),
          } as never);
        } catch (err) {
          this.logger.error(`Failed to relay outbox row ${row.id}: ${(err as Error).message}`);
          await manager.increment(this.repo.target, { id: row.id } as never, 'publishAttempts', 1);
          // Row stays unpublished; picked up again next tick. A dead-letter
          // threshold (e.g. publishAttempts > 10) should page an operator.
        }
      }

      return rows.length;
    });
  }
}
