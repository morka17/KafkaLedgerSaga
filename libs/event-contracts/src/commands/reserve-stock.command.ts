import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const RESERVE_STOCK_COMMAND = 'inventory.reserve_stock.v1';
export const RELEASE_INVENTORY_COMMAND = 'inventory.release.v1';

export class ReserveStockLine {
  sku!: string;
  qty!: number;
}

export class ReserveStockCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveStockLine)
  lines!: ReserveStockLine[];
}

/** Compensating command - published by the saga orchestrator to undo a reservation. */
export class ReleaseInventoryCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  reservationId!: string;
}
