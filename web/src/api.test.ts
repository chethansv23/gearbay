import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { appointment } from './test/fixtures';

function mockFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(body === undefined ? '' : JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the Idempotency-Key header when booking', async () => {
    const fetchMock = mockFetch(201, appointment);

    const result = await api.book({
      dealerId: 'GB-BLR-IND', customerName: 'Test Rider', customerPhone: '9845011111', vehicleType: 'BIKE',
      vehicleNumber: 'KA05TR4242', serviceTypes: ['GENERAL_SERVICE'], slotStart: '2030-01-07T10:00',
    }, 'key-123');

    expect(result.id).toBe(appointment.id);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/appointments');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe('key-123');
    expect(JSON.parse(init.body).slotStart).toBe('2030-01-07T10:00');
  });

  it('turns a problem response into an ApiError with the server message and code', async () => {
    mockFetch(409, { status: 409, code: 'SLOT_UNAVAILABLE', detail: 'No BIKE bay is free at 10:00' });

    const error = await api.complete('x').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('SLOT_UNAVAILABLE');
    expect(error.message).toBe('No BIKE bay is free at 10:00');
  });

  it('lists field validation errors using the labels shown on screen', async () => {
    mockFetch(400, { code: 'VALIDATION_FAILED', detail: 'Request validation failed',
      errors: { customerPhone: 'must be 10-15 digits', vehicleNumber: 'must not be blank' } });

    await expect(api.checkIn('x')).rejects.toThrow('Mobile must be 10-15 digits, Registration number must not be blank');
  });

  it('falls back to the API field name when there is no label', async () => {
    mockFetch(400, { code: 'VALIDATION_FAILED', errors: { 'lines[0].sku': 'must not be blank' } });

    await expect(api.checkIn('x')).rejects.toThrow('lines[0].sku must not be blank');
  });

  it('builds query strings for availability and parts', async () => {
    const fetchMock = mockFetch(200, []);

    await api.availability('GB-BLR-WHF', 'CAR', ['AC_SERVICE', 'OIL_CHANGE'], '2030-01-07');
    await api.parts('GB-BLR-WHF', 'BIKE');
    await api.parts('GB-BLR-WHF');

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/appointments/availability?dealerId=GB-BLR-WHF&vehicleType=CAR&serviceTypes=AC_SERVICE,OIL_CHANGE&date=2030-01-07',
      '/api/parts?dealerId=GB-BLR-WHF&fitment=BIKE',
      '/api/parts?dealerId=GB-BLR-WHF',
    ]);
  });
});
