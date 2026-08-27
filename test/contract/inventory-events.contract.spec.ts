import 'reflect-metadata';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  INVENTORY_TOPIC,
  InventoryEventType,
  InventoryReservedPayload,
  InventoryReservationFailedPayload,
  InventoryReleasedPayload,
} from '@saganova/event-contracts';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const RESERVATION_ID = '44444444-4444-4444-8444-444444444444';

describe('inventory.events contract', () => {
  it('InventoryReserved: a well-formed payload passes validation', () => {
    const payload = plainToInstance(InventoryReservedPayload, {
      reservationId: RESERVATION_ID,
      orderId: ORDER_ID,
      lines: [{ sku: 'SKU-42', qty: 2 }],
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('InventoryReservationFailed: identifies the specific SKU that failed (StockRepository.reserveLinesWithinTransaction always sets this)', () => {
    const payload = plainToInstance(InventoryReservationFailedPayload, {
      orderId: ORDER_ID,
      sku: 'SKU-DECLINE',
      reason: 'Requested 1 of "SKU-DECLINE", only 0 available',
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('InventoryReleased: the compensating event carries the same reservationId the original reservation used', () => {
    const payload = plainToInstance(InventoryReleasedPayload, {
      reservationId: RESERVATION_ID,
      orderId: ORDER_ID,
    });
    expect(validateSync(payload)).toHaveLength(0);
  });

  it('INVENTORY_TOPIC matches infra/kafka-topics/topics.yaml', () => {
    expect(INVENTORY_TOPIC).toBe('inventory.events');
  });

  it('every InventoryEventType value follows the versioned dot-namespace convention', () => {
    for (const value of Object.values(InventoryEventType)) {
      expect(value).toMatch(/^[a-z]+(\.[a-z_]+)+\.v\d+$/);
    }
  });
});
