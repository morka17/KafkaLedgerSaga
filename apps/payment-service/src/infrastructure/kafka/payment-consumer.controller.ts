import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  AUTHORIZE_PAYMENT_COMMAND,
  AuthorizePaymentCommandPayload,
  CommandEnvelope,
  REFUND_PAYMENT_COMMAND,
  RefundPaymentCommandPayload,
} from '@saganova/event-contracts';
import { PaymentApplicationService } from '../../application/payment-application.service';

@Controller()
export class PaymentConsumerController {
  constructor(private readonly payments: PaymentApplicationService) {}

  @EventPattern(AUTHORIZE_PAYMENT_COMMAND)
  async handleAuthorize(@Payload() command: CommandEnvelope<AuthorizePaymentCommandPayload>): Promise<void> {
    await this.payments.authorizePayment(command);
  }

  @EventPattern(REFUND_PAYMENT_COMMAND)
  async handleRefund(@Payload() command: CommandEnvelope<RefundPaymentCommandPayload>): Promise<void> {
    await this.payments.refundPayment(command);
  }
}
