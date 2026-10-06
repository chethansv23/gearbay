/**
 * Postgres returns numeric columns as strings ("1675.60"). Money is handled as integer paise in code
 * and converted at the edges, so totals never suffer from floating-point rounding.
 */
export function toPaise(value) {
  if (value == null) return null;
  const [rupees, fraction = ''] = String(value).split('.');
  const sign = rupees.startsWith('-') ? -1 : 1;
  return sign * (Math.abs(Number(rupees)) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2)));
}

/** Paise → rupees as a number with two decimals, for JSON responses. */
export const toRupees = (paise) => (paise == null ? null : paise / 100);

/** Paise → "1675.60", for numeric columns and messages. */
export const formatRupees = (paise) => (paise / 100).toFixed(2);

/** Rounds half up, like Java's RoundingMode.HALF_UP. */
export const percentOf = (paise, percent) => Math.round((paise * percent) / 100);
