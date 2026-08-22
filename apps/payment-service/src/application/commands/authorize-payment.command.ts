export class AuthorizePaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly amountCents: number,
    public readonly correlationId: string,
  ) {}
}

export class RefundPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly paymentId: string,
    public readonly amountCents: number,
    public readonly correlationId: string,
  ) {}
}
