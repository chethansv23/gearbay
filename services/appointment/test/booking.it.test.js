import path from 'node:path';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppointmentService } from '../src/appointmentService.js';
import { noCache, silentLogger, startPostgres } from '../../../test/support/postgres.js';

/**
 * Proves the double-booking guarantee against a real Postgres: many customers race for the same slot
 * and exactly as many succeed as there are bays, with no deadlocks.
 */
describe('booking against Postgres', () => {
  let db;
  let service;

  beforeAll(async () => {
    // Enough connections for every racing request to reach the database at once.
    db = await startPostgres(path.join(import.meta.dirname, '../migrations'), { maxConnections: 60 });
    service = createAppointmentService({ pool: db.pool, cache: noCache, logger: silentLogger });
  });
  afterAll(() => db?.stop());

  const slot = (days, hour) => DateTime.now().setZone('Asia/Kolkata').plus({ days })
    .set({ hour, minute: 0, second: 0, millisecond: 0 }).toFormat("yyyy-MM-dd'T'HH:mm");
  const bike = (dealerId, slotStart, i, serviceType = 'GENERAL_SERVICE') => ({
    dealerId, customerName: `Rider ${i}`, customerPhone: `98450${String(i).padStart(5, '0')}`,
    vehicleType: 'BIKE', vehicleNumber: `KA53EZ${i}`, serviceType, slotStart,
  });

  async function race(dealerId, slotStart, customers, serviceType) {
    const results = await Promise.allSettled(
      Array.from({ length: customers }, (_, i) => service.book(bike(dealerId, slotStart, i, serviceType))));
    const unexpected = results.filter((r) => r.status === 'rejected' && r.reason.code !== 'SLOT_UNAVAILABLE');
    return { booked: results.filter((r) => r.status === 'fulfilled').length, unexpected };
  }

  it('lets exactly 2 of 50 riders book the 2 bike stands at Indiranagar', async () => {
    const { booked, unexpected } = await race('GB-BLR-IND', slot(7, 10), 50);
    expect(unexpected.map((r) => r.reason.message)).toEqual([]);
    expect(booked).toBe(2);
  });

  it('lets exactly 4 of 50 riders book the 4 bike stands at Whitefield, without deadlocks', async () => {
    const { booked, unexpected } = await race('GB-BLR-WHF', slot(11, 15), 50, 'OIL_CHANGE');
    expect(unexpected.map((r) => r.reason.message)).toEqual([]);
    expect(booked).toBe(4);
  });

  it('returns the original booking when the idempotency key is reused', async () => {
    const request = bike('GB-BLR-IND', slot(8, 11), 1);
    const first = await service.book(request, 'key-123');
    const retry = await service.book(request, 'key-123');

    expect(first.replayed).toBe(false);
    expect(retry.replayed).toBe(true);
    expect(retry.appointment.id).toBe(first.appointment.id);
    const { rows } = await db.pool.query('select count(*)::int as n from outbox_event where aggregate_id = $1', [first.appointment.id]);
    expect(rows[0].n).toBe(1);
  });

  it('frees the bay when an appointment is cancelled', async () => {
    const at = slot(9, 14);
    const a = await service.book(bike('GB-BLR-IND', at, 1));
    await service.book(bike('GB-BLR-IND', at, 2));
    await expect(service.book(bike('GB-BLR-IND', at, 3))).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    await service.cancel(a.appointment.id, 'Customer travelling');

    expect((await service.book(bike('GB-BLR-IND', at, 3))).appointment.status).toBe('BOOKED');
  });

  it('refuses a car-only job for a bike', async () => {
    await expect(service.book(bike('GB-BLR-IND', slot(10, 10), 1, 'WHEEL_ALIGNMENT')))
      .rejects.toMatchObject({ code: 'SERVICE_NOT_OFFERED' });
  });

  it('validates the grid and opening hours', async () => {
    await expect(service.book(bike('GB-BLR-IND', slot(12, 10).replace(':00', ':15'), 1)))
      .rejects.toMatchObject({ code: 'OFF_GRID' });
    await expect(service.book(bike('GB-BLR-IND', slot(12, 17).replace('T17:00', 'T17:30'), 1)))
      .rejects.toMatchObject({ code: 'OUTSIDE_HOURS' });
  });

  it('reports availability per vehicle type', async () => {
    const date = slot(13, 9).slice(0, 10);
    const availability = await service.availability({ dealerId: 'GB-BLR-IND', vehicleType: 'CAR', serviceType: 'AC_SERVICE', date });
    expect(availability.durationMinutes).toBe(90);
    expect(availability.slots[0]).toEqual({ start: '09:00:00', end: '10:30:00', freeBays: 3 });
  });
});
