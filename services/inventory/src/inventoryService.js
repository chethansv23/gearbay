import { randomUUID } from 'node:crypto';
import { AggregateTypes, ApiError, EventTypes, Topics, appendOutbox, toPaise, toRupees, withTransaction } from '@gearbay/common';
import { Fitment, ReservationStatus } from './constants/index.js';
import { available, isLowStock, partView, reservationView } from './dto/views.js';

/**
 * Row-locks the requested SKUs. Locks are always taken in SKU order so two reservations that touch
 * overlapping parts queue behind each other instead of deadlocking.
 */
async function lockParts(client, dealerId, skus) {
  const { rows } = await client.query(
    'select * from part where dealer_id = $1 and sku = any($2) order by sku for update', [dealerId, skus]);
  return new Map(rows.map((p) => [p.sku, p]));
}

export function createInventoryService({ pool, logger }) {

  const publish = (client, aggregateType, aggregateId, eventType, payload) =>
    appendOutbox(client, { topic: Topics.INVENTORY_EVENTS, aggregateType, aggregateId, eventType, payload });

  async function settle(client, repairOrderId, outcome) {
    const { rows: reservations } = await client.query(
      'select * from reservation where repair_order_id = $1 and status = $2', [repairOrderId, ReservationStatus.RESERVED]);
    for (const reservation of reservations) {
      const { rows: lines } = await client.query('select * from reservation_line where reservation_id = $1', [reservation.id]);
      const parts = await lockParts(client, reservation.dealer_id, lines.map((l) => l.sku));
      for (const line of lines) {
        const consumed = outcome === ReservationStatus.CONSUMED;
        const { rows: [part] } = await client.query(
          `update part set reserved = reserved - $3, on_hand = on_hand - $4, version = version + 1
           where dealer_id = $1 and sku = $2 returning *`,
          [reservation.dealer_id, line.sku, line.quantity, consumed ? line.quantity : 0]);
        if (consumed && isLowStock(part)) {
          await publish(client, AggregateTypes.PART, `${part.dealer_id}:${part.sku}`, EventTypes.PART_LOW_STOCK, {
            dealerId: part.dealer_id, sku: part.sku, name: parts.get(line.sku).name,
            available: available(part), reorderLevel: part.reorder_level,
          });
        }
      }
      await client.query('update reservation set status = $2, settled_at = now() where id = $1', [reservation.id, outcome]);
      logger.info({ reservationId: reservation.id, repairOrderId, outcome }, 'Settled reservation');
    }
  }

  return {
    /**
     * All-or-nothing: either every line is reserved or none is. Availability is checked after taking
     * the row locks, so the check and the update cannot interleave with another request.
     */
    async reserve(client, request) {
      const seen = await client.query('select 1 from reservation where request_id = $1', [request.requestId]);
      if (seen.rowCount > 0) return;
      const wanted = new Map();
      for (const { sku, quantity } of request.lines) wanted.set(sku, (wanted.get(sku) ?? 0) + quantity);
      const parts = await lockParts(client, request.dealerId, [...wanted.keys()]);

      const problems = [];
      for (const [sku, quantity] of wanted) {
        const part = parts.get(sku);
        if (!part) problems.push(`${sku} is not stocked at ${request.dealerId}`);
        else if (available(part) < quantity) problems.push(`${sku} needs ${quantity}, only ${available(part)} available`);
      }
      if (problems.length > 0) {
        const reason = problems.join('; ');
        logger.info({ requestId: request.requestId, reason }, 'Rejecting parts request');
        await publish(client, AggregateTypes.RESERVATION, request.repairOrderId, EventTypes.PARTS_RESERVATION_FAILED,
          { requestId: request.requestId, repairOrderId: request.repairOrderId, reason });
        return;
      }

      const reservationId = randomUUID();
      await client.query(
        'insert into reservation (id, request_id, repair_order_id, dealer_id, status, created_at) values ($1,$2,$3,$4,$5, now())',
        [reservationId, request.requestId, request.repairOrderId, request.dealerId, ReservationStatus.RESERVED]);
      const reserved = [];
      for (const [sku, quantity] of wanted) {
        const part = parts.get(sku);
        await client.query('update part set reserved = reserved + $3, version = version + 1 where dealer_id = $1 and sku = $2',
          [request.dealerId, sku, quantity]);
        await client.query('insert into reservation_line (reservation_id, sku, quantity, unit_price) values ($1,$2,$3,$4)',
          [reservationId, sku, quantity, part.unit_price]);
        reserved.push({ sku, name: part.name, quantity, unitPrice: toRupees(toPaise(part.unit_price)) });
      }
      await publish(client, AggregateTypes.RESERVATION, request.repairOrderId, EventTypes.PARTS_RESERVED,
        { requestId: request.requestId, repairOrderId: request.repairOrderId, lines: reserved });
      logger.info({ repairOrderId: request.repairOrderId, lines: reserved.length }, 'Reserved parts');
    },

    /** Repair order completed: reserved parts were fitted, so they leave stock for good. */
    consumeFor: (client, repairOrderId) => settle(client, repairOrderId, ReservationStatus.CONSUMED),

    /** Repair order cancelled: compensating action that returns reserved stock to the shelf. */
    releaseFor: (client, repairOrderId) => settle(client, repairOrderId, ReservationStatus.RELEASED),

    /** CAR or BIKE also returns UNIVERSAL parts, since those fit both. */
    async list(dealerId, fitment) {
      const fitments = !fitment || fitment === Fitment.UNIVERSAL ? Object.values(Fitment) : [fitment, Fitment.UNIVERSAL];
      const { rows } = await pool.query('select * from part where dealer_id = $1 and fitment = any($2) order by sku', [dealerId, fitments]);
      return rows.map(partView);
    },

    async get(dealerId, sku) {
      const { rows } = await pool.query('select * from part where dealer_id = $1 and sku = $2', [dealerId, sku]);
      if (!rows[0]) throw ApiError.notFound('Part', `${dealerId}/${sku}`);
      return partView(rows[0]);
    },

    restock(dealerId, sku, quantity) {
      return withTransaction(pool, async (client) => {
        const { rows } = await client.query(
          'update part set on_hand = on_hand + $3, version = version + 1 where dealer_id = $1 and sku = $2 returning *',
          [dealerId, sku, quantity]);
        if (!rows[0]) throw ApiError.notFound('Part', `${dealerId}/${sku}`);
        return partView(rows[0]);
      });
    },

    async reservations(repairOrderId) {
      const { rows } = await pool.query('select * from reservation where repair_order_id = $1 order by created_at', [repairOrderId]);
      return Promise.all(rows.map(async (r) =>
        reservationView(r, (await pool.query('select * from reservation_line where reservation_id = $1', [r.id])).rows)));
    },
  };
}
