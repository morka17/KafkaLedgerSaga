import { OrderConfirmedPayload, OrderCancelledPayload, PaymentDeclinedPayload } from '@saganova/event-contracts';

export function orderConfirmedEmail(payload: OrderConfirmedPayload) {
  return {
    subject: `Your order ${payload.orderId} is confirmed`,
    body: `Good news! Your order has been confirmed and payment ${payload.paymentId} was successful. We'll notify you again once it ships.`,
  };
}

export function orderCancelledEmail(payload: OrderCancelledPayload) {
  return {
    subject: `Your order ${payload.orderId} was cancelled`,
    body: `Unfortunately your order could not be completed: ${payload.reason}. You have not been charged.`,
  };
}

export function paymentDeclinedSms(payload: PaymentDeclinedPayload) {
  return {
    body: `Saganova: your payment for order ${payload.orderId} was declined (${payload.reason}). Please update your payment method.`,
  };
}
