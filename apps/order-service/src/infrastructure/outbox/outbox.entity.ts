import { Entity } from 'typeorm';
import { OutboxRowBase } from '@saganova/database';

@Entity({ schema: 'order_service', name: 'outbox' })
export class OrderOutboxEntity extends OutboxRowBase {}
