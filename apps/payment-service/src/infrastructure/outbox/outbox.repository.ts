import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxAbstractRepository } from '@saganova/database';
import { PaymentOutboxEntity } from './outbox.entity';

@Injectable()
export class PaymentOutboxRepository extends OutboxAbstractRepository<PaymentOutboxEntity> {
  constructor(@InjectRepository(PaymentOutboxEntity) repo: Repository<PaymentOutboxEntity>) {
    super(repo);
  }
}
