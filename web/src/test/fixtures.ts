import type { Appointment, Dealer, Part, RepairOrder, ServiceTypeInfo } from '../api';

export const dealer: Dealer = {
  id: 'GB-BLR-IND', name: 'Gearbay Indiranagar', city: 'Bengaluru', timezone: 'Asia/Kolkata',
  openTime: '09:00:00', closeTime: '18:00:00', bayCount: { CAR: 3, BIKE: 2 },
};

export const serviceTypes: ServiceTypeInfo[] = [
  { code: 'GENERAL_SERVICE', description: 'Periodic maintenance service', durationMinutes: { CAR: 120, BIKE: 60 } },
  { code: 'WHEEL_ALIGNMENT', description: 'Wheel alignment', durationMinutes: { CAR: 60 } },
  { code: 'CHAIN_SPROCKET', description: 'Chain and sprocket kit replacement', durationMinutes: { BIKE: 60 } },
  { code: 'BRAKE_SERVICE', description: 'Brake inspection and pad replacement', durationMinutes: { CAR: 90, BIKE: 60 } },
];

export const appointment: Appointment = {
  id: 'de63d0bd-0000-4000-8000-000000000001', dealerId: 'GB-BLR-IND', bayId: 4, status: 'BOOKED',
  customerName: 'Test Rider', customerPhone: '9845011111', vehicleType: 'BIKE', vehicleNumber: 'KA05TR4242',
  vehicleMake: 'Bajaj', vehicleModel: 'Pulsar NS200', serviceTypes: ['GENERAL_SERVICE'],
  localStart: '2030-01-07T10:00:00', localEnd: '2030-01-07T11:00:00',
};

export function repairOrder(overrides: Partial<RepairOrder> = {}): RepairOrder {
  return {
    id: 'dfbb355a-64e6-421a-9751-ceaeb06204e9', roNumber: 'RO-2030-001002', appointmentId: appointment.id,
    dealerId: 'GB-BLR-IND', status: 'OPEN', customerName: 'Test Rider', customerPhone: '9845011111',
    vehicleType: 'BIKE', vehicleNumber: 'KA05TR4242', vehicleMake: 'Bajaj', vehicleModel: 'Pulsar NS200',
    serviceTypes: ['GENERAL_SERVICE'], odometerKm: 12400, parts: [],
    labourLines: [{ serviceType: 'GENERAL_SERVICE', minutes: 60, amount: 400 }], labourAmount: 400,
    openedAt: '2030-01-07T04:40:00Z',
    ...overrides,
  };
}

export const completedOrder = repairOrder({
  status: 'COMPLETED', technician: 'Ravi K', closedAt: '2030-01-07T06:00:00Z',
  parts: [
    { sku: 'BRAKE-PAD-BIKE', name: 'Disc brake pad set (bike)', quantity: 1, unitPrice: 650, status: 'RESERVED' },
    { sku: 'OIL-10W30-1L', name: 'Engine oil 10W-30, 1 L', quantity: 1, unitPrice: 450, status: 'RESERVED' },
    { sku: 'CHAIN-KIT', quantity: 2, status: 'REJECTED' },
  ],
  partsAmount: 1100, taxAmount: 270, totalAmount: 1770,
});

export function part(overrides: Partial<Part> = {}): Part {
  return {
    dealerId: 'GB-BLR-IND', sku: 'CHAIN-KIT', name: 'Chain and sprocket kit', fitment: 'BIKE', unitPrice: 2200,
    onHand: 5, reserved: 0, available: 5, reorderLevel: 2, lowStock: false, ...overrides,
  };
}
