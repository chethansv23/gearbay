import { describe, expect, it } from 'vitest';
import { decode } from '../src/kafka.js';

describe('decode', () => {
  it('reads the envelope headers and JSON payload', () => {
    const event = decode({
      headers: { eventId: Buffer.from('e-1'), eventType: Buffer.from('RepairOrderCancelled') },
      value: Buffer.from('{"repairOrderId":"r-1","reason":"Customer declined"}'),
    });
    expect(event).toEqual({ eventId: 'e-1', eventType: 'RepairOrderCancelled',
      payload: { repairOrderId: 'r-1', reason: 'Customer declined' } });
  });

  it('rejects a message without an envelope', () => {
    expect(() => decode({ headers: {}, value: Buffer.from('{}') })).toThrow("Missing header 'eventId'");
  });
});
