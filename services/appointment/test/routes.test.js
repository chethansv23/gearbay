import { ApiError, createApp } from '@gearbay/common';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appointmentRoutes } from '../src/routes.js';
import { silentLogger } from '../../../test/support/postgres.js';

const VALID = {
  dealerId: 'GB-BLR-IND', customerName: 'Asha', customerPhone: '9845000001', vehicleType: 'BIKE',
  vehicleNumber: 'KA03HB1234', serviceTypes: ['OIL_CHANGE', 'TYRE_REPLACEMENT'], slotStart: '2030-01-07T10:00',
};

/** HTTP contract of the booking API, with the service stubbed out. */
describe('appointment routes', () => {
  let service;
  let app;

  beforeEach(() => {
    service = { book: vi.fn(), cancel: vi.fn() };
    app = createApp({ logger: silentLogger, routes: appointmentRoutes({ pool: null, service }) });
  });

  it('answers 201 for a new booking and passes the idempotency key through', async () => {
    service.book.mockResolvedValue({ appointment: { id: 'a-1', status: 'BOOKED' }, replayed: false });

    const res = await request(app).post('/api/appointments').set('Idempotency-Key', 'key-1').send(VALID);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('a-1');
    expect(service.book).toHaveBeenCalledWith(expect.objectContaining({ vehicleType: 'BIKE' }), 'key-1');
  });

  it('answers 200 when the same key is replayed', async () => {
    service.book.mockResolvedValue({ appointment: { id: 'a-1' }, replayed: true });
    const res = await request(app).post('/api/appointments').set('Idempotency-Key', 'key-1').send(VALID);
    expect(res.status).toBe(200);
  });

  it('turns a full slot into a 409 problem with a stable code', async () => {
    service.book.mockRejectedValue(ApiError.conflict('SLOT_UNAVAILABLE', 'No BIKE bay is free'));

    const res = await request(app).post('/api/appointments').send(VALID);

    expect(res.status).toBe(409);
    expect(res.type).toBe('application/problem+json');
    expect(res.body).toMatchObject({ code: 'SLOT_UNAVAILABLE', detail: 'No BIKE bay is free' });
  });

  it('rejects an invalid phone with field details before reaching the service', async () => {
    const res = await request(app).post('/api/appointments').send({ ...VALID, customerPhone: '12ab' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.customerPhone).toMatch(/10-15 digits/);
    expect(service.book).not.toHaveBeenCalled();
  });

  it('passes several services through, without repeats', async () => {
    service.book.mockResolvedValue({ appointment: { id: 'a-1' }, replayed: false });
    await request(app).post('/api/appointments').send({ ...VALID, serviceTypes: ['OIL_CHANGE', 'BRAKE_SERVICE', 'OIL_CHANGE'] });
    expect(service.book.mock.calls[0][0].serviceTypes).toEqual(['OIL_CHANGE', 'BRAKE_SERVICE']);
  });

  it('still accepts a single serviceType from older clients', async () => {
    service.book.mockResolvedValue({ appointment: { id: 'a-1' }, replayed: false });
    const { serviceTypes, ...legacy } = VALID;
    await request(app).post('/api/appointments').send({ ...legacy, serviceType: 'OIL_CHANGE' });
    expect(service.book.mock.calls[0][0].serviceTypes).toEqual(['OIL_CHANGE']);
  });

  it('requires at least one and at most five services', async () => {
    const none = await request(app).post('/api/appointments').send({ ...VALID, serviceTypes: [] });
    expect(none.status).toBe(400);
    expect(none.body.errors.serviceTypes).toBe('choose at least one service');

    const six = ['GENERAL_SERVICE', 'OIL_CHANGE', 'BRAKE_SERVICE', 'TYRE_REPLACEMENT', 'CLUTCH_OVERHAUL', 'CHAIN_SPROCKET'];
    const tooMany = await request(app).post('/api/appointments').send({ ...VALID, serviceTypes: six });
    expect(tooMany.body.errors.serviceTypes).toBe('choose at most 5 services');
    expect(service.book).not.toHaveBeenCalled();
  });

  it('reads comma-separated services from the availability query', async () => {
    service.availability = vi.fn().mockResolvedValue({ slots: [] });
    await request(app).get('/api/appointments/availability')
      .query({ dealerId: 'GB-BLR-IND', vehicleType: 'BIKE', serviceTypes: 'GENERAL_SERVICE,BRAKE_SERVICE', date: '2030-01-07' });
    expect(service.availability).toHaveBeenCalledWith(expect.objectContaining({ serviceTypes: ['GENERAL_SERVICE', 'BRAKE_SERVICE'] }));
  });

  it('requires a reason to cancel', async () => {
    const res = await request(app).post('/api/appointments/a-1/cancel').send({ reason: '' });
    expect(res.status).toBe(400);
    expect(service.cancel).not.toHaveBeenCalled();
  });

  it('serves the service catalogue', async () => {
    const res = await request(app).get('/api/dealers/service-types');
    expect(res.body.find((s) => s.code === 'WHEEL_ALIGNMENT').durationMinutes).toEqual({ CAR: 60 });
  });
});
