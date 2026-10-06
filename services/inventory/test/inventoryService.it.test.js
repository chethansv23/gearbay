import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { processOnce, withTransaction } from '@gearbay/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInventoryService } from '../src/inventoryService.js';
import { silentLogger, startPostgres } from '../../../test/support/postgres.js';

const DEALER = 'GB-BLR-IND';

describe('inventory against Postgres', () => {
  let db;
  let service;

  beforeAll(async () => {
    db = await startPostgres(path.join(import.meta.dirname, '../migrations'));
    service = createInventoryService({ pool: db.pool, logger: silentLogger });
  });
  afterAll(() => db?.stop());

  const reserve = (lines) => {
    const request = { requestId: randomUUID(), repairOrderId: randomUUID(), dealerId: DEALER, lines };
    return withTransaction(db.pool, (client) => service.reserve(client, request)).then(() => request);
  };
  const lastEvent = async (aggregateId) => (await db.pool.query(
    'select event_type, payload from outbox_event where aggregate_id = $1 order by created_at desc limit 1', [aggregateId])).rows[0];

  it('reserves every line and reports prices', async () => {
    const before = await service.get(DEALER, 'OIL-10W30-1L');
    const request = await reserve([{ sku: 'OIL-10W30-1L', quantity: 1 }, { sku: 'SPARK-PLUG-BIKE', quantity: 2 }]);

    const event = await lastEvent(request.repairOrderId);
    expect(event.event_type).toBe('PartsReserved');
    expect(event.payload.lines.map((l) => `${l.sku}@${l.unitPrice}`).sort()).toEqual(['OIL-10W30-1L@450', 'SPARK-PLUG-BIKE@150']);
    expect((await service.get(DEALER, 'OIL-10W30-1L')).available).toBe(before.available - 1);
  });

  it('rejects the whole request when any line is short, reserving nothing', async () => {
    const oil = await service.get(DEALER, 'OIL-5W30-4L');
    const request = await reserve([{ sku: 'OIL-5W30-4L', quantity: 1 }, { sku: 'CHAIN-KIT', quantity: 2 }]);

    const event = await lastEvent(request.repairOrderId);
    expect(event.event_type).toBe('PartsReservationFailed');
    expect(event.payload.reason).toBe('CHAIN-KIT needs 2, only 1 available');
    expect((await service.get(DEALER, 'OIL-5W30-4L')).reserved).toBe(oil.reserved);
  });

  it('reports unknown parts', async () => {
    const request = await reserve([{ sku: 'TURBO-KIT', quantity: 1 }]);
    expect((await lastEvent(request.repairOrderId)).payload.reason).toBe(`TURBO-KIT is not stocked at ${DEALER}`);
  });

  it('consumes stock on completion and raises a low-stock alert', async () => {
    // Bike oil filters: 8 on hand, reorder level 6, so fitting 3 leaves 5 and should alert.
    const request = await reserve([{ sku: 'OIL-FILTER-BIKE', quantity: 3 }]);
    await withTransaction(db.pool, (client) => service.consumeFor(client, request.repairOrderId));

    const part = await service.get(DEALER, 'OIL-FILTER-BIKE');
    expect(part).toMatchObject({ onHand: 5, reserved: 0, lowStock: true });
    const alert = await lastEvent(`${DEALER}:OIL-FILTER-BIKE`);
    expect(alert.event_type).toBe('PartLowStock');
    expect(alert.payload).toMatchObject({ available: 5, reorderLevel: 6 });
    expect((await service.reservations(request.repairOrderId))[0].status).toBe('CONSUMED');
  });

  it('returns stock to the shelf on cancellation', async () => {
    const before = await service.get(DEALER, 'BRAKE-PAD-BIKE');
    const request = await reserve([{ sku: 'BRAKE-PAD-BIKE', quantity: 2 }]);
    await withTransaction(db.pool, (client) => service.releaseFor(client, request.repairOrderId));

    expect(await service.get(DEALER, 'BRAKE-PAD-BIKE')).toMatchObject({ onHand: before.onHand, available: before.available });
  });

  it('applies a redelivered event only once', async () => {
    const before = await service.get(DEALER, 'COOLANT-1L');
    const request = { requestId: randomUUID(), repairOrderId: randomUUID(), dealerId: DEALER, lines: [{ sku: 'COOLANT-1L', quantity: 1 }] };
    const eventId = randomUUID();

    const first = await processOnce(db.pool, eventId, (client) => service.reserve(client, request));
    const second = await processOnce(db.pool, eventId, (client) => service.reserve(client, request));

    expect([first, second]).toEqual([true, false]);
    expect((await service.get(DEALER, 'COOLANT-1L')).reserved).toBe(before.reserved + 1);
  });
});
