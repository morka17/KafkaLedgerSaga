import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ReservationProjectionEntity } from './reservation.entity';
import { StockAggregate } from '../../domain/stock.aggregate';

@Injectable()
export class ReservationProjectionRepository {
  constructor(
    @InjectRepository(ReservationProjectionEntity)
    private readonly repo: Repository<ReservationProjectionEntity>,
  ) {}

  async findByOrderId(orderId: string): Promise<ReservationProjectionEntity | null> {
    return this.repo.findOne({ where: { orderId } });
  }

  static async upsertWithinTransaction(manager: EntityManager, aggregate: StockAggregate): Promise<void> {
    const snapshot = aggregate.snapshot;
    await manager.upsert(
      ReservationProjectionEntity,
      {
        orderId: aggregate.aggregateId,
        status: snapshot.status,
        reservationId: snapshot.reservationId,
        lines: snapshot.lines,
        failedSku: snapshot.failedSku,
        failReason: snapshot.failReason,
        version: aggregate.version,
      },
      ['orderId'],
    );
  }
}
