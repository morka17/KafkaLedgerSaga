import { NotFoundException } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { OrderProjectionRepository } from '../../infrastructure/postgres/order.repository';
import { OrderProjectionEntity } from '../../infrastructure/postgres/order.entity';

export class GetOrderByIdQuery implements IQuery {
  constructor(public readonly orderId: string) {}
}

/**
 * Reads from the projection table, never from event_store - replaying
 * the full event stream on every read would work but doesn't scale, and
 * defeats the point of maintaining a read model at all.
 */
@QueryHandler(GetOrderByIdQuery)
export class GetOrderByIdHandler implements IQueryHandler<GetOrderByIdQuery, OrderProjectionEntity> {
  constructor(private readonly projectionRepository: OrderProjectionRepository) {}

  async execute(query: GetOrderByIdQuery): Promise<OrderProjectionEntity> {
    const order = await this.projectionRepository.findById(query.orderId);
    if (!order) {
      throw new NotFoundException(`No order found with id ${query.orderId}`);
    }
    return order;
  }
}
