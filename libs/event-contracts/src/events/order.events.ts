import { IsArray, IsNumber, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const ORDER_TOPIC = 'order.events';

export enum OrderEventType {
  ORDER_CREATED = 'order.created.v1',
  ORDER_CONFIRMED = 'order.confirmed.v1',
  ORDER_CANCELLED = 'order.cancelled.v1',
}

export class OrderLineItem {
  @IsString()
  sku!: string;

  @IsNumber()
  @IsPositive()
  qty!: number;

  @IsNumber()
  @IsPositive()
  unitPriceCents!: number;
}

/** Emitted by order-service the instant an order aggregate is created. */
export class OrderCreatedPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItem)
  items!: OrderLineItem[];

  @IsNumber()
  totalCents!: number;
}

/** Emitted once the saga completes successfully. */
export class OrderConfirmedPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  paymentId!: string;
}

/** Emitted when the saga fails at any step and compensations have completed. */
export class OrderCancelledPayload {
  @IsUUID()
  orderId!: string;

  @IsString()
  reason!: string;
}
