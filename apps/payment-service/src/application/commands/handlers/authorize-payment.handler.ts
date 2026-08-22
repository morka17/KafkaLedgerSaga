import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { AuthorizePaymentCommand } from '../authorize-payment.command';
import { PaymentAggregate } from '../../../domain/payment.aggregate';
import { PaymentEventStoreRepository } from '../../../infrastructure/event-store/event-store.repository';
import { PaymentProjectionRepository } from '../../../infrastructure/postgres/payment.repository';
import { PAYMENT_GATEWAY, PaymentGateway } from '../../../infrastructure/gateways/payment-gateway.interface';

@Injectable()
@CommandHandler(AuthorizePaymentCommand)
export class AuthorizePaymentHandler implements ICommandHandler<AuthorizePaymentCommand> {
  private readonly logger = new Logger(AuthorizePaymentHandler.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly repository: PaymentEventStoreRepository,
    private readonly projectionRepository: PaymentProjectionRepository,
  ) {}

  async execute(command: AuthorizePaymentCommand): Promise<void> {
    // Idempotency guard BEFORE calling Stripe: this command can be
    // redelivered by Kafka's at-least-once semantics, and while Stripe's
    // own idempotencyKey prevents a duplicate CHARGE, we'd still create a
    // second PaymentAuthorized event for the same order without this check.
    const existing = await this.projectionRepository.findByOrderId(command.orderId);
    if (existing) {
      this.logger.warn(
        `AuthorizePayment for order ${command.orderId} is a duplicate delivery ` +
          `(payment ${existing.paymentId} already ${existing.status}) - skipping Stripe call.`,
      );
      return;
    }

    const paymentId = randomUUID();
    const idempotencyKey = `authorize:${command.orderId}`; // stable across redeliveries -> Stripe itself also dedups

    const result = await this.gateway.authorize({
      orderId: command.orderId,
      customerId: command.customerId,
      amountCents: command.amountCents,
      idempotencyKey,
    });

    const aggregate = result.success
      ? PaymentAggregate.authorize(paymentId, command.orderId, command.customerId, command.amountCents, result.pspReference as string)
      : PaymentAggregate.decline(paymentId, command.orderId, result.declineCode ?? 'unknown', result.reason ?? 'Payment declined');

    await this.repository.save(aggregate, command.correlationId);

    this.logger.log(
      result.success
        ? `Payment ${paymentId} authorized for order ${command.orderId} (${command.amountCents} cents)`
        : `Payment ${paymentId} declined for order ${command.orderId}: ${result.reason}`,
    );
  }
}
