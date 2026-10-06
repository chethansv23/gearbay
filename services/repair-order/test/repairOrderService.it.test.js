import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { withTransaction } from '@gearbay/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepairOrderService } from '../src/repairOrderService.js';
import { silentLogger, startPostgres } from '../../../test/support/postgres.js';

describe('repair orders against Postgres', () => {
  let db;
  let service;

  beforeAll(async () => {
    db = await startPostgres(path.join(import.meta.dirname, '../migrations'));
    service = createRepairOrderService({ pool: db.pool, logger: silentLogger });
  });
  afterAll(() => db?.stop());

  const lastEvent = async (id) => (await db.pool.query(
    "select event_type, payload from outbox_event where aggregate_id = $1 order by created_at desc limit 1", [id])).rows[0];

  async function openCarJob(serviceTypes = ['WHEEL_ALIGNMENT']) {
    const appointmentId = randomUUID();
    await withTransaction(db.pool, (client) => service.openFromCheckIn(client, {
      appointmentId, dealerId: 'GB-BLR-WHF', customerName: 'Asha', customerPhone: '9845000001', vehicleType: 'CAR',
      vehicleNumber: 'KA01MJ4321', vehicleMake: 'Hyundai', vehicleModel: 'Creta', serviceTypes, odometerKm: 42000,
    }));
    const { rows } = await db.pool.query('select id from repair_order where appointment_id = $1', [appointmentId]);
    return { id: rows[0].id, appointmentId };
  }

  it('opens a numbered job card once per appointment and announces it', async () => {
    const { id, appointmentId } = await openCarJob();
    const order = await service.get(id);
    expect(order.roNumber).toMatch(/^RO-\d{4}-\d{6}$/);
    expect(order.labourAmount).toBe(800); // 1 h at ₹800
    expect((await lastEvent(id)).event_type).toBe('RepairOrderCreated');

    await withTransaction(db.pool, (client) => service.openFromCheckIn(client, { appointmentId }));
    const { rows } = await db.pool.query('select count(*)::int as n from repair_order where appointment_id = $1', [appointmentId]);
    expect(rows[0].n).toBe(1);
  });

  it('charges labour for each service on a combined job card', async () => {
    const { id } = await openCarJob(['WHEEL_ALIGNMENT', 'AC_SERVICE']);
    const order = await service.get(id);

    expect(order.serviceTypes).toEqual(['WHEEL_ALIGNMENT', 'AC_SERVICE']);
    expect(order.labourLines).toEqual([
      { serviceType: 'WHEEL_ALIGNMENT', minutes: 60, amount: 800 },
      { serviceType: 'AC_SERVICE', minutes: 90, amount: 1200 },
    ]);
    expect(order.labourAmount).toBe(2000);

    await service.assign(id, 'Ravi K');
    expect((await service.complete(id)).totalAmount).toBe(2360); // 2,000 + 18% GST
  });

  it('runs the parts saga to an invoice with GST', async () => {
    const { id } = await openCarJob();
    await service.assign(id, 'Ravi K');
    const pending = await service.requestParts(id, [{ sku: 'wiper-blade-pair', quantity: 1 }, { sku: 'WIPER-BLADE-PAIR', quantity: 1 }]);
    expect(pending.status).toBe('PARTS_PENDING');
    const request = (await lastEvent(id)).payload;
    expect(request.lines).toEqual([{ sku: 'WIPER-BLADE-PAIR', quantity: 2 }]);

    await withTransaction(db.pool, (client) => service.onPartsReserved(client, {
      requestId: request.requestId, repairOrderId: id, lines: [{ sku: 'WIPER-BLADE-PAIR', name: 'Wiper blade pair', quantity: 2, unitPrice: 900 }],
    }));
    const done = await service.complete(id);

    expect(done.status).toBe('COMPLETED');
    expect(done.partsAmount).toBe(1800);
    expect(done.taxAmount).toBe(468); // 18% of 2,600
    expect(done.totalAmount).toBe(3068);
    expect((await lastEvent(id)).payload.totalAmount).toBe(3068);
  });

  it('records a rejected parts request and does not charge for it', async () => {
    const { id } = await openCarJob();
    await service.assign(id, 'Ravi K');
    await service.requestParts(id, [{ sku: 'AC-GAS-R134A', quantity: 5 }]);
    const { requestId } = (await lastEvent(id)).payload;

    await withTransaction(db.pool, (client) => service.onPartsReservationFailed(client,
      { requestId, repairOrderId: id, reason: 'AC-GAS-R134A needs 5, only 2 available' }));
    const order = await service.get(id);

    expect(order.status).toBe('IN_PROGRESS');
    expect(order.note).toContain('only 2 available');
    expect(order.parts[0].status).toBe('REJECTED');
  });

  it('ignores a late inventory reply after the order was cancelled', async () => {
    const { id } = await openCarJob();
    await service.assign(id, 'Ravi K');
    await service.requestParts(id, [{ sku: 'CABIN-FILTER', quantity: 1 }]);
    const { requestId } = (await lastEvent(id)).payload;
    await service.cancel(id, 'Customer declined');
    expect((await lastEvent(id)).event_type).toBe('RepairOrderCancelled');

    await withTransaction(db.pool, (client) => service.onPartsReserved(client,
      { requestId, repairOrderId: id, lines: [{ sku: 'CABIN-FILTER', name: 'Cabin AC filter', quantity: 1, unitPrice: 550 }] }));

    expect((await service.get(id)).status).toBe('CANCELLED');
  });

  it('refuses to complete while parts are pending', async () => {
    const { id } = await openCarJob();
    await service.assign(id, 'Ravi K');
    await service.requestParts(id, [{ sku: 'CABIN-FILTER', quantity: 1 }]);
    await expect(service.complete(id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
