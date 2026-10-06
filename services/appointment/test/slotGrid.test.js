import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { computeSlots, isOnGrid } from '../src/slotGrid.js';

const zone = 'Asia/Kolkata';
const date = '2030-01-07';
const at = (time) => DateTime.fromISO(`${date}T${time}`, { zone }).toJSDate();
const base = { date, zone, openTime: '09:00:00', bayIds: [1], busy: [], now: new Date(0) };

describe('computeSlots', () => {
  it('ends the last slot exactly at closing time', () => {
    const slots = computeSlots({ ...base, closeTime: '18:00:00', durationMinutes: 120 });
    expect(slots[0].start).toBe('09:00:00');
    expect(slots.at(-1).end).toBe('18:00:00');
    expect(slots).toHaveLength(15);
  });

  it('reduces free bays only while a booking overlaps', () => {
    const slots = computeSlots({ ...base, closeTime: '12:00:00', durationMinutes: 60, bayIds: [1, 2],
      busy: [{ bayId: 1, start: at('10:00'), end: at('11:00') }] });
    // 09:00 09:30 10:00 10:30 11:00
    expect(slots.map((s) => s.freeBays)).toEqual([2, 1, 1, 1, 2]);
  });

  it("ignores bookings on the other vehicle type's bays", () => {
    const slots = computeSlots({ ...base, closeTime: '10:00:00', durationMinutes: 30, bayIds: [4],
      busy: [{ bayId: 99, start: at('09:00'), end: at('18:00') }] });
    expect(slots.every((s) => s.freeBays === 1)).toBe(true);
  });

  it('hides slots that have already started', () => {
    const slots = computeSlots({ ...base, closeTime: '11:00:00', durationMinutes: 30, now: at('10:15') });
    expect(slots.map((s) => s.start)).toEqual(['10:30:00']);
  });
});

describe('isOnGrid', () => {
  it('accepts only the hour and half hour', () => {
    expect(isOnGrid(DateTime.fromISO('2030-01-07T09:30'))).toBe(true);
    expect(isOnGrid(DateTime.fromISO('2030-01-07T09:15'))).toBe(false);
    expect(isOnGrid(DateTime.fromISO('2030-01-07T09:00:05'))).toBe(false);
  });
});
