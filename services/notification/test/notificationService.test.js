import { describe, expect, it, vi } from 'vitest';
import { createNotificationService } from '../src/notificationService.js';
import { templates } from '../src/templates.js';

describe('templates', () => {
  it('shows the booking time in IST', () => {
    expect(templates.booked({
      appointmentId: '0a1b2c3d-0000-0000-0000-000000000000', customerName: 'Asha', vehicleType: 'BIKE',
      vehicleNumber: 'KA03HB1234', serviceTypes: ['CHAIN_SPROCKET'], slotStart: '2030-01-07T04:30:00Z',
    })).toBe('Hi Asha, your bike KA03HB1234 for chain sprocket is confirmed for Mon 7 Jan, 10:00 AM. Ref 0A1B2C3D.');
  });

  it('lists every booked service', () => {
    expect(templates.booked({
      appointmentId: '0a1b2c3d-0000-0000-0000-000000000000', customerName: 'Asha', vehicleType: 'BIKE',
      vehicleNumber: 'KA03HB1234', serviceTypes: ['GENERAL_SERVICE', 'BRAKE_SERVICE'], slotStart: '2030-01-07T04:30:00Z',
    })).toContain('for general service + brake service is confirmed');
  });

  it('includes the invoice total on completion', () => {
    expect(templates.roCompleted({ customerName: 'Vikram', vehicleNumber: 'KA01MJ4321', roNumber: 'RO-2030-001001', totalAmount: 4130 }))
      .toContain('Invoice RO-2030-001001 total Rs 4130.00');
  });
});

describe('notification service', () => {
  const setup = () => {
    const sender = { send: vi.fn() };
    const client = { query: vi.fn() };
    return { sender, client, service: createNotificationService({ pool: null, sender }) };
  };

  it('texts the customer and records the message', async () => {
    const { sender, client, service } = setup();
    await service.handle(client, { eventId: 'e-1', eventType: 'RepairOrderCreated',
      payload: { roNumber: 'RO-2030-001001', vehicleNumber: 'KA03HB1234', customerPhone: '9845000001' } });

    expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({ channel: 'SMS', recipient: '9845000001' }));
    expect(client.query.mock.calls[0][1]).toEqual(expect.arrayContaining(['e-1', 'RepairOrderCreated', 'SMS']));
  });

  it("emails the dealer's service manager about low stock", async () => {
    const { sender, client, service } = setup();
    await service.handle(client, { eventId: 'e-2', eventType: 'PartLowStock',
      payload: { dealerId: 'GB-BLR-WHF', sku: 'CHAIN-KIT', name: 'Chain kit', available: 1, reorderLevel: 2 } });

    expect(sender.send).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'EMAIL', recipient: 'manager+GB-BLR-WHF@gearbay.dev', message: expect.stringContaining('has 1 available') }));
  });

  it('ignores internal events', async () => {
    const { sender, client, service } = setup();
    await service.handle(client, { eventId: 'e-3', eventType: 'PartsReserved', payload: {} });
    expect(sender.send).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});
