import { OrderLineItem } from '@saganova/event-contracts';

export class CreateOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: OrderLineItem[],
    public readonly correlationId: string,
  ) {}
}

export class ConfirmOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly paymentId: string,
    public readonly correlationId: string,
  ) {}
}

export class CancelOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: string,
    public readonly correlationId: string,
  ) {}
}
