import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  EventEnvelope,
  OrderCancelledPayload,
  ORDER_TOPIC,
  OrderConfirmedPayload,
  OrderEventType,
  PaymentDeclinedPayload,
  PaymentEventType,
  PAYMENT_TOPIC,
} from '@saganova/event-contracts';
import { EmailProvider } from '../channels/email.provider';
import { SmsProvider } from '../channels/sms.provider';

@Controller()
export class NotificationConsumerController {
  constructor(
    private readonly email: EmailProvider,
    private readonly sms: SmsProvider,
  ) {}

  @EventPattern(OrderEventType.ORDER_CONFIRMED)
  async handleOrderConfirmed(@Payload() event: EventEnvelope<OrderConfirmedPayload>): Promise<void> {
    await this.email.sendTransactionalEmail(
      'Order confirmed',
      `Order ${event.payload.orderId} has been confirmed and payment ${event.payload.paymentId} was captured.`,
      event.payload.orderId,
    );
    await this.sms.sendSms(`Your order ${event.payload.orderId} is confirmed.`, event.payload.orderId);
  }

  @EventPattern(OrderEventType.ORDER_CANCELLED)
  async handleOrderCancelled(@Payload() event: EventEnvelope<OrderCancelledPayload>): Promise<void> {
    await this.email.sendTransactionalEmail(
      'Order cancelled',
      `Order ${event.payload.orderId} was cancelled: ${event.payload.reason}.`,
      event.payload.orderId,
    );
  }

  @EventPattern(PaymentEventType.PAYMENT_DECLINED)
  async handlePaymentDeclined(@Payload() event: EventEnvelope<PaymentDeclinedPayload>): Promise<void> {
    await this.email.sendTransactionalEmail(
      'Payment declined',
      `Payment for order ${event.payload.orderId} was declined: ${event.payload.reason}.`,
      event.payload.orderId,
    );
  }
}
