import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser, AuthenticatedUser, CORRELATION_ID_HEADER } from '@saganova/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService, CreateOrderResult, OrderStatusResult } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Returns 202 Accepted, not 201 Created - the order aggregate exists,
   * but the saga (inventory reservation, payment authorization) is still
   * in flight. Clients poll GET /orders/:orderId for the outcome.
   */
  @Post()
  @HttpCode(202)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @Req() req: RequestWithCorrelationId,
  ): Promise<CreateOrderResult> {
    const correlationId = req.correlationId ?? (req.headers[CORRELATION_ID_HEADER] as string);
    return this.ordersService.createOrder(user.id, dto, correlationId);
  }

  @Get(':orderId')
  async getStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: RequestWithCorrelationId,
  ): Promise<OrderStatusResult> {
    const correlationId = req.correlationId ?? (req.headers[CORRELATION_ID_HEADER] as string);
    return this.ordersService.getOrderStatus(orderId, correlationId);
  }
}
