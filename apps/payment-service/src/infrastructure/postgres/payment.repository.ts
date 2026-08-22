import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaymentProjectionEntity } from './payment.entity';
import { PaymentAggregate } from '../../domain/payment.aggregate';

@Injectable()
export class PaymentProjectionRepository {
  constructor(
    @InjectRepository(PaymentProjectionEntity)
    private readonly repo: Repository<PaymentProjectionEntity>,
  ) {}

  async findById(paymentId: string): Promise<PaymentProjectionEntity | null> {
    return this.repo.findOne({ where: { paymentId } });
  }

  /**
   * Used by AuthorizePaymentHandler's idempotency check: if a payment
   * already exists for this order, a redelivered AuthorizePayment
   * command must NOT call Stripe again.
   */
  async findByOrderId(orderId: string): Promise<PaymentProjectionEntity | null> {
    return this.repo.findOne({ where: { orderId } });
  }

  static async upsertWithinTransaction(manager: EntityManager, aggregate: PaymentAggregate): Promise<void> {
    const snapshot = aggregate.snapshot;
    await manager.upsert(
      PaymentProjectionEntity,
      {
        paymentId: aggregate.aggregateId,
        orderId: snapshot.orderId,
        status: snapshot.status,
        amountCents: snapshot.amountCents,
        pspReference: snapshot.pspReference,
        declineCode: snapshot.declineCode,
        reason: snapshot.reason,
        version: aggregate.version,
      },
      ['paymentId'],
    );
  }
}
