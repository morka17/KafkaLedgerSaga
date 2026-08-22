import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RefundPaymentCommand } from '../authorize-payment.command';
import { PaymentAlreadyFinalizedError } from '../../../domain/payment.aggregate';
import { PaymentEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';
import { PAYMENT_GATEWAY, PaymentGateway } from '../../../infrastructure/gateways/payment-gateway.interface';

/**
 * The compensating handler for the checkout saga: fired by
 * saga-orchestrator when a LATER step (never happens here, since payment
 * is the last forward step, but this also serves manual/ops-triggered
 * refunds and any future step added after payment) fails and this
 * payment needs to be undone.
 */
@Injectable()
@CommandHandler(RefundPaymentCommand)
export class RefundPaymentHandler implements ICommandHandler<RefundPaymentCommand> {
  private readonly logger = new Logger(RefundPaymentHandler.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly repository: PaymentEventStoreRepository,
  ) {}

  async execute(command: RefundPaymentCommand): Promise<void> {
    const aggregate = await this.repository.loadAggregate(command.paymentId);
    if (!aggregate) {
      throw new NotFoundException(`Cannot refund payment ${command.paymentId}: no such payment.`);
    }

    const pspReference = aggregate.snapshot.pspReference;
    if (!pspReference) {
      // Should be unreachable: refund() below already guards on status
      // AUTHORIZED, which is the only state with a pspReference set.
      throw new Error(`Payment ${command.paymentId} has no pspReference to refund against.`);
    }

    try {
      // Call Stripe FIRST, then record the domain event - if Stripe
      // succeeds but the DB write fails, the outbox relay/retry will
      // never re-attempt the Stripe call (aggregate.refund() below would
      // throw PaymentAlreadyFinalizedError on the next attempt only
      // AFTER this succeeds - so a crash here needs an ops-level
      // reconciliation job in a full production build).
      await this.gateway.refund(pspReference, command.amountCents, 'Saga compensation');
      aggregate.refund('Saga compensation: a later saga step failed');
    } catch (err) {
      if (err instanceof PaymentAlreadyFinalizedError) {
        this.logger.warn(`RefundPayment for ${command.paymentId} is a duplicate delivery - ignoring.`);
        return;
      }
      throw err;
    }

    await this.repository.save(aggregate, command.correlationId);
    this.logger.log(`Payment ${command.paymentId} refunded (order=${command.orderId})`);
  }
}
