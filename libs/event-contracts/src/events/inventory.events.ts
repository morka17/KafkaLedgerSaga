import { IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const INVENTORY_TOPIC = 'inventory.events';

export enum InventoryEventType {
  INVENTORY_RESERVED = 'inventory.reserved.v1',
  INVENTORY_RESERVATION_FAILED = 'inventory.reservation_failed.v1',
  INVENTORY_RELEASED = 'inventory.released.v1',
}

export class ReservationLine {
  @IsString()
  sku!: string;

  qty!: number;
}

export class InventoryReservedPayload {
  @IsUUID()
  reservationId!: string;

  @IsUUID()
  orderId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationLine)
  lines!: ReservationLine[];
}

export class InventoryReservationFailedPayload {
  @IsUUID()
  orderId!: string;

  @IsString()
  sku!: string;

  @IsString()
  reason!: string; // e.g. "INSUFFICIENT_STOCK"
}

/** Compensating event - undoes a prior reservation when a later saga step fails. */
export class InventoryReleasedPayload {
  @IsUUID()
  reservationId!: string;

  @IsUUID()
  orderId!: string;
}
