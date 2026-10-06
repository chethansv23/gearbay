import { describe, expect, it } from 'vitest';
import { dayLabel, humanize, isoDate, nextDays, rupees, time12, timeOf } from './format';

describe('format', () => {
  it('formats rupees in the Indian numbering system', () => {
    expect(rupees(1770)).toBe('₹1,770.00');
    expect(rupees(125000)).toBe('₹1,25,000.00');
    expect(rupees(undefined)).toBe('-');
  });

  it('turns enum codes into readable labels and keeps AC upper case', () => {
    expect(humanize('GENERAL_SERVICE')).toBe('General service');
    expect(humanize('AC_SERVICE')).toBe('AC service');
    expect(humanize('CHECKED_IN')).toBe('Checked in');
  });

  it('converts 24-hour times to 12-hour', () => {
    expect(time12('09:00:00')).toBe('9:00 AM');
    expect(time12('12:30:00')).toBe('12:30 PM');
    expect(time12('17:00')).toBe('5:00 PM');
    expect(time12('00:15')).toBe('12:15 AM');
    expect(timeOf('2030-01-07T14:30:00')).toBe('2:30 PM');
  });

  it('lists consecutive days starting today', () => {
    const days = nextDays(3);
    expect(days).toHaveLength(3);
    expect(isoDate(days[0])).toBe(isoDate(new Date()));
    expect(dayLabel(days[0]).top).toBe('Today');
    expect(dayLabel(days[1]).top).toBe('Tomorrow');
  });
});
