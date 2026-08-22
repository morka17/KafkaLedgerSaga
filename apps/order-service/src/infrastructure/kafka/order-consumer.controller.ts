import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  CANCEL_ORDER_COMMAND,
  CONFIRM_ORDER_COMMAND,
  CREATE_ORDER_COMMAND,
  CancelOrderCommandPayload,
  CommandEnvelope,
  ConfirmOrderCommandPayload,
  CreateOrderCommandPayload,
} from '@saganova/event-contracts';
import { OrderApplicationService } from '../../application/order-application.service';

@Controller()
export class OrderConsumerController {
  constructor(private readonly orders: OrderApplicationService) {}

  @EventPattern(CREATE_ORDER_COMMAND)
  async handleCreate(@Payload() command: CommandEnvelope<CreateOrderCommandPayload>): Promise<void> {
    await this.orders.createOrder(command);
  }

  @EventPattern(CONFIRM_ORDER_COMMAND)
  async handleConfirm(@Payload() command: CommandEnvelope<ConfirmOrderCommandPayload>): Promise<void> {
    await this.orders.confirmOrder(command);
  }

  @EventPattern(CANCEL_ORDER_COMMAND)
  async handleCancel(@Payload() command: CommandEnvelope<CancelOrderCommandPayload>): Promise<void> {
    await this.orders.cancelOrder(command);
  }
}
