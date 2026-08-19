import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export const AUTHORIZE_PAYMENT_COMMAND = 'payment.authorize.v1';
export const REFUND_PAYMENT_COMMAND = 'payment.refund.v1';
export const CONFIRM_ORDER_COMMAND = 'order.confirm.v1';
export const CANCEL_ORDER_COMMAND = 'order.cancel.v1';

export class AuthorizePaymentCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  customerId!: string;

  @IsNumber()
  @IsPositive()
  amountCents!: number;
}

/** Compensating command - published by the saga orchestrator to undo an authorization. */
export class RefundPaymentCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  paymentId!: string;

  @IsNumber()
  @IsPositive()
  amountCents!: number;
}

export class ConfirmOrderCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  paymentId!: string;
}

export class CancelOrderCommandPayload {
  @IsUUID()
  orderId!: string;

  reason!: string;
}
