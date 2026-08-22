import { Entity } from 'typeorm';
import { OutboxRowBase } from '@saganova/database';

@Entity('payment_outbox')
export class PaymentOutboxRow extends OutboxRowBase {}
