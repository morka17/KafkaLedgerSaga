export enum OrderStatus {
  /** Aggregate exists but hasn't yet had ORDER_CREATED applied - never observable outside the aggregate. */
  UNINITIALIZED = 'UNINITIALIZED',
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}
