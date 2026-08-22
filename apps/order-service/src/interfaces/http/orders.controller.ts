import { Controller, Get, Param } from '@nestjs/common';
import { OrderApplicationService } from '../../application/order-application.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrderApplicationService) {}

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.orders.getOrder(orderId);
  }
}
