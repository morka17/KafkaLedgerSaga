import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxAbstractRepository } from '@saganova/database';
import { InventoryOutboxEntity } from './outbox.entity';

@Injectable()
export class InventoryOutboxRepository extends OutboxAbstractRepository<InventoryOutboxEntity> {
  constructor(@InjectRepository(InventoryOutboxEntity) repo: Repository<InventoryOutboxEntity>) {
    super(repo);
  }
}
