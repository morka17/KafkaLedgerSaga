import { ReservationLine } from '@saganova/event-contracts';

export class ReserveStockCommand {
  constructor(
    public readonly orderId: string,
    public readonly lines: ReservationLine[],
    public readonly correlationId: string,
  ) {}
}

export class ReleaseInventoryCommand {
  constructor(
    public readonly orderId: string,
    public readonly reservationId: string,
    public readonly correlationId: string,
  ) {}
}
