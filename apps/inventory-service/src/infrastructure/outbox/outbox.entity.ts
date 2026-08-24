import { Entity } from 'typeorm';
import { OutboxRowBase } from '@saganova/database';

@Entity({ schema: 'inventory_service', name: 'outbox' })
export class InventoryOutboxEntity extends OutboxRowBase {}
