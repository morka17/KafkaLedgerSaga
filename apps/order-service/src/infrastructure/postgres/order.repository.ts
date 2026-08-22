import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrderProjectionEntity } from './order.entity';
import { OrderAggregate } from '../../domain/order.aggregate';

/**
 * Read-only access to the projection table for queries. Writes to this
 * table only ever happen from inside OrderEventStoreRepository.save()'s
 * transaction - this repository never mutates it directly, keeping a
 * single writer for the projection.
 */
@Injectable()
export class OrderProjectionRepository {
  constructor(
    @InjectRepository(OrderProjectionEntity)
    private readonly repo: Repository<OrderProjectionEntity>,
  ) {}

  async findById(orderId: string): Promise<OrderProjectionEntity | null> {
    return this.repo.findOne({ where: { orderId } });
  }

  async findByCustomerId(customerId: string): Promise<OrderProjectionEntity[]> {
    return this.repo.find({ where: { customerId }, order: { updatedAt: 'DESC' } });
  }

  /** Called only from within the event-store repository's transaction. */
  static async upsertWithinTransaction(manager: EntityManager, aggregate: OrderAggregate): Promise<void> {
    const snapshot = aggregate.snapshot;
    await manager.upsert(
      OrderProjectionEntity,
      {
        orderId: aggregate.aggregateId,
        customerId: snapshot.customerId,
        status: snapshot.status,
        items: snapshot.items,
        totalCents: snapshot.totalCents,
        paymentId: snapshot.paymentId,
        cancelReason: snapshot.cancelReason,
        version: aggregate.version,
      },
      ['orderId'],
    );
  }
}
