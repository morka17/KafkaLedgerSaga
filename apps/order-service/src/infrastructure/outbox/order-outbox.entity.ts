import { Entity } from 'typeorm';
import { OutboxRowBase } from '@saganova/database';

@Entity('order_outbox')
export class OrderOutboxRow extends OutboxRowBase {}
