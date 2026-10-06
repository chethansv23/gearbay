import { ApiError, percentOf } from '@gearbay/common';
import { GST_PERCENT, PartLineStatus, RepairOrderErrorCodes, RepairOrderStatus as S } from './constants/index.js';

/**
 * OPEN --assign--> IN_PROGRESS --request parts--> PARTS_PENDING
 *                   ^    |                            |
 *                   |    +--complete--> COMPLETED     |
 *                   +------ parts reserved/failed ----+
 * OPEN, IN_PROGRESS, PARTS_PENDING --cancel--> CANCELLED
 */
export const TRANSITIONS = Object.freeze({
  [S.OPEN]: [S.IN_PROGRESS, S.CANCELLED],
  [S.IN_PROGRESS]: [S.PARTS_PENDING, S.COMPLETED, S.CANCELLED],
  [S.PARTS_PENDING]: [S.IN_PROGRESS, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
});

export const canMoveTo = (from, to) => TRANSITIONS[from].includes(to);

export function assertTransition(order, to) {
  if (!canMoveTo(order.status, to)) {
    throw ApiError.conflict(RepairOrderErrorCodes.INVALID_TRANSITION,
      `Repair order ${order.ro_number} cannot go from ${order.status} to ${to}`);
  }
}

/** Invoice in paise: labour + reserved parts only + GST. Rejected parts are never charged. */
export function computeInvoice(labourPaise, lines) {
  const partsPaise = lines.filter((l) => l.status === PartLineStatus.RESERVED)
    .reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);
  const taxPaise = percentOf(labourPaise + partsPaise, GST_PERCENT);
  return { partsPaise, taxPaise, totalPaise: labourPaise + partsPaise + taxPaise };
}

/** Adds up duplicate SKUs and normalises them ("  brake-pad " and "BRAKE-PAD" are the same part). */
export function mergeLines(lines) {
  const merged = new Map();
  for (const { sku, quantity } of lines) {
    const key = sku.trim().toUpperCase();
    merged.set(key, (merged.get(key) ?? 0) + quantity);
  }
  return [...merged].map(([sku, quantity]) => ({ sku, quantity }));
}
