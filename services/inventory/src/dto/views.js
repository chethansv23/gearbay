import { toPaise, toRupees } from '@gearbay/common';

export const available = (p) => p.on_hand - p.reserved;
export const isLowStock = (p) => available(p) <= p.reorder_level;

export function partView(p) {
  return {
    dealerId: p.dealer_id, sku: p.sku, name: p.name, fitment: p.fitment, unitPrice: toRupees(toPaise(p.unit_price)),
    onHand: p.on_hand, reserved: p.reserved, available: available(p), reorderLevel: p.reorder_level, lowStock: isLowStock(p),
  };
}

export function reservationView(r, lines) {
  return {
    id: r.id, requestId: r.request_id, repairOrderId: r.repair_order_id, dealerId: r.dealer_id, status: r.status,
    createdAt: r.created_at.toISOString(), settledAt: r.settled_at?.toISOString() ?? null,
    lines: lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: toRupees(toPaise(l.unit_price)) })),
  };
}
