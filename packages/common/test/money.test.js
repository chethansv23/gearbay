import { describe, expect, it } from 'vitest';
import { formatRupees, percentOf, toPaise, toRupees } from '../src/money.js';

describe('money', () => {
  it('parses Postgres numeric strings into integer paise exactly', () => {
    expect(toPaise('1675.60')).toBe(167_560);
    expect(toPaise('400.00')).toBe(40_000);
    expect(toPaise('0.07')).toBe(7);
    expect(toPaise('12')).toBe(1200);
    expect(toPaise(null)).toBeNull();
  });

  it('computes 18% GST with half-up rounding', () => {
    expect(percentOf(150_000, 18)).toBe(27_000);
    expect(percentOf(1, 50)).toBe(1);
  });

  it('formats for responses and messages', () => {
    expect(toRupees(177_000)).toBe(1770);
    expect(formatRupees(167_560)).toBe('1675.60');
  });
});
