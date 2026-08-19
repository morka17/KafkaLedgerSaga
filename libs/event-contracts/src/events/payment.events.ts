import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export const PAYMENT_TOPIC = 'payment.events';

export enum PaymentEventType {
  PAYMENT_AUTHORIZED = 'payment.authorized.v1',
  PAYMENT_DECLINED = 'payment.declined.v1',
  PAYMENT_REFUNDED = 'payment.refunded.v1',
}

export class PaymentAuthorizedPayload {
  @IsUUID()
  paymentId!: string;

  @IsUUID()
  orderId!: string;

  @IsNumber()
  @IsPositive()
  amountCents!: number;

  @IsString()
  pspReference!: string; // e.g. Stripe PaymentIntent id
}

export class PaymentDeclinedPayload {
  @IsUUID()
  paymentId!: string;

  @IsUUID()
  orderId!: string;

  @IsString()
  declineCode!: string;

  @IsString()
  reason!: string;
}

/** Compensating event - emitted when a saga rolls back a prior authorization. */
export class PaymentRefundedPayload {
  @IsUUID()
  paymentId!: string;

  @IsUUID()
  orderId!: string;

  @IsNumber()
  @IsPositive()
  amountCents!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
