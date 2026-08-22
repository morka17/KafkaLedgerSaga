import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxAbstractRepository } from '@saganova/database';
import { OrderOutboxEntity } from './outbox.entity';

@Injectable()
export class OrderOutboxRepository extends OutboxAbstractRepository<OrderOutboxEntity> {
  constructor(@InjectRepository(OrderOutboxEntity) repo: Repository<OrderOutboxEntity>) {
    super(repo);
  }
}
