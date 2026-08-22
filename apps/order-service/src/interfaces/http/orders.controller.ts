import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetOrderByIdQuery } from '../../application/queries/get-order-by-id.handler';
import { OrderProjectionEntity } from '../../infrastructure/postgres/order.entity';

/**
 * Internal-only REST surface - reachable from other services and ops
 * tooling on the cluster-internal network, NOT exposed publicly (the
 * public entrypoint is api-gateway, which talks to this service only
 * via Kafka commands, never HTTP). Useful for the saga-orchestrator's
 * debugging tools and for direct curl access during local development.
 */
@Controller('internal/orders')
export class OrdersHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':orderId')
  async getById(@Param('orderId', ParseUUIDPipe) orderId: string): Promise<OrderProjectionEntity> {
    return this.queryBus.execute(new GetOrderByIdQuery(orderId));
  }
}
