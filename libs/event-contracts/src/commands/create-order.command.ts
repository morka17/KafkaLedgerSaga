import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderLineItem } from '../events/order.events';

export const SAGA_COMMANDS_TOPIC = 'saga.commands';
export const CREATE_ORDER_COMMAND = 'order.create.v1';

/** Published by api-gateway; consumed by order-service to bootstrap the saga. */
export class CreateOrderCommandPayload {
  @IsUUID()
  orderId!: string;

  @IsUUID()
  customerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItem)
  items!: OrderLineItem[];
}
