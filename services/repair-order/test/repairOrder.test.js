import { describe, expect, it } from 'vitest';
import { assertTransition, canMoveTo, computeInvoice, mergeLines } from '../src/repairOrder.js';

describe('repair order rules', () => {
  it('allows only the defined transitions', () => {
    expect(canMoveTo('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canMoveTo('OPEN', 'COMPLETED')).toBe(false);
    expect(canMoveTo('PARTS_PENDING', 'COMPLETED')).toBe(false);
    expect(canMoveTo('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('explains a refused transition with a stable code', () => {
    expect(() => assertTransition({ status: 'PARTS_PENDING', ro_number: 'RO-2030-001001' }, 'COMPLETED'))
      .toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION', message: expect.stringContaining('PARTS_PENDING to COMPLETED') }));
  });

  it('invoices labour plus reserved parts plus 18% GST, never rejected parts', () => {
    const invoice = computeInvoice(40_000, [
      { status: 'RESERVED', unitPricePaise: 45_000, quantity: 1 },
      { status: 'RESERVED', unitPricePaise: 15_000, quantity: 1 },
      { status: 'REJECTED', unitPricePaise: 220_000, quantity: 2 },
    ]);
    expect(invoice).toEqual({ partsPaise: 60_000, taxPaise: 18_000, totalPaise: 118_000 }); // ₹1,180
  });

  it('merges duplicate SKUs and normalises them', () => {
    expect(mergeLines([{ sku: ' brake-pad-car-f ', quantity: 1 }, { sku: 'BRAKE-PAD-CAR-F', quantity: 1 }, { sku: 'wiper', quantity: 1 }]))
      .toEqual([{ sku: 'BRAKE-PAD-CAR-F', quantity: 2 }, { sku: 'WIPER', quantity: 1 }]);
  });
});
