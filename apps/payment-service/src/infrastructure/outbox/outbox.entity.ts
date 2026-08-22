import { Entity } from 'typeorm';
import { OutboxRowBase } from '@saganova/database';

@Entity({ schema: 'payment_service', name: 'outbox' })
export class PaymentOutboxEntity extends OutboxRowBase {}
