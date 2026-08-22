export interface AuthorizeParams {
  orderId: string;
  customerId: string;
  amountCents: number;
  /** Stable per-order key so a redelivered command can't double-charge, even before our own aggregate-existence check runs. */
  idempotencyKey: string;
}

export interface AuthorizeResult {
  success: boolean;
  pspReference?: string;
  declineCode?: string;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/**
 * Anti-corruption-layer boundary: everything above this interface (the
 * aggregate, command handlers) knows nothing about Stripe specifically -
 * only about "authorize" and "refund". Swapping payment providers means
 * writing a new adapter, not touching domain logic.
 */
export interface PaymentGateway {
  authorize(params: AuthorizeParams): Promise<AuthorizeResult>;
  refund(pspReference: string, amountCents: number, reason?: string): Promise<RefundResult>;
}
