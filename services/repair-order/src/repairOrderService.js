import { randomUUID } from 'node:crypto';
import {
  AggregateTypes, ApiError, EventTypes, Topics, appendOutbox, formatRupees, toPaise, toRupees, totalLabourPaise,
  withTransaction,
} from '@gearbay/common';
import { PartLineStatus, RO_NUMBER_SEQUENCE_QUERY, RepairOrderStatus as S, roNumber } from './constants/index.js';
import { repairOrderView } from './dto/views.js';
import { assertTransition, computeInvoice, mergeLines } from './repairOrder.js';

const ORDER_COLUMNS_LIST = 'order by opened_at desc';

export function createRepairOrderService({ pool, logger }) {

  async function load(db, id, { forUpdate = false } = {}) {
    const { rows } = await db.query(`select * from repair_order where id = $1${forUpdate ? ' for update' : ''}`, [id]);
    if (!rows[0]) throw ApiError.notFound('Repair order', id);
    return rows[0];
  }

  const linesOf = async (db, id) =>
    (await db.query('select * from part_line where repair_order_id = $1 order by sku', [id])).rows;

  async function view(db, order) {
    return repairOrderView(order, await linesOf(db, order.id));
  }

  function publish(client, order, eventType, payload) {
    return appendOutbox(client, {
      topic: Topics.REPAIR_ORDER_EVENTS, aggregateType: AggregateTypes.REPAIR_ORDER,
      aggregateId: order.id, eventType, payload,
    });
  }

  /** Runs `change` on the locked order in a transaction and returns the updated view. */
  function mutate(id, change) {
    return withTransaction(pool, async (client) => {
      const order = await load(client, id, { forUpdate: true });
      await change(client, order);
      return view(client, await load(client, id));
    });
  }

  /** A reply only counts if the order is still waiting for that exact request (it may have been cancelled). */
  async function pendingLines(client, order, requestId) {
    if (order.status !== S.PARTS_PENDING) return [];
    const { rows } = await client.query(
      'select * from part_line where repair_order_id = $1 and request_id = $2 and status = $3',
      [order.id, requestId, PartLineStatus.REQUESTED]);
    return rows;
  }

  return {
    /** Consumer of AppointmentCheckedIn; `client` is the idempotent consumer's transaction. */
    async openFromCheckIn(client, e) {
      const exists = await client.query('select 1 from repair_order where appointment_id = $1', [e.appointmentId]);
      if (exists.rowCount > 0) {
        logger.info({ appointmentId: e.appointmentId }, 'Repair order already exists for appointment');
        return;
      }
      const { rows: [{ seq }] } = await client.query(RO_NUMBER_SEQUENCE_QUERY);
      const id = randomUUID();
      const number = roNumber(new Date().getFullYear(), seq);
      const { rows: [order] } = await client.query(
        `insert into repair_order (id, ro_number, appointment_id, dealer_id, customer_name, customer_phone, vehicle_type,
           vehicle_number, vehicle_make, vehicle_model, service_types, odometer_km, status, labour_amount, opened_at, version)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(), 0) returning *`,
        [id, number, e.appointmentId, e.dealerId, e.customerName, e.customerPhone, e.vehicleType, e.vehicleNumber,
          e.vehicleMake, e.vehicleModel, e.serviceTypes, e.odometerKm, S.OPEN,
          formatRupees(totalLabourPaise(e.serviceTypes, e.vehicleType))]);
      await publish(client, order, EventTypes.REPAIR_ORDER_CREATED, {
        repairOrderId: id, roNumber: number, appointmentId: e.appointmentId, dealerId: e.dealerId,
        customerName: e.customerName, customerPhone: e.customerPhone, vehicleNumber: e.vehicleNumber,
      });
      logger.info({ roNumber: number }, 'Opened repair order');
    },

    async get(id) {
      return view(pool, await load(pool, id));
    },

    async list(dealerId, status) {
      const { rows } = status
        ? await pool.query(`select * from repair_order where dealer_id = $1 and status = $2 ${ORDER_COLUMNS_LIST}`, [dealerId, status])
        : await pool.query(`select * from repair_order where dealer_id = $1 ${ORDER_COLUMNS_LIST}`, [dealerId]);
      return Promise.all(rows.map((o) => view(pool, o)));
    },

    assign(id, technician) {
      return mutate(id, async (client, order) => {
        assertTransition(order, S.IN_PROGRESS);
        await client.query('update repair_order set status = $2, technician = $3, version = version + 1 where id = $1',
          [id, S.IN_PROGRESS, technician]);
      });
    },

    /** Saga step 1: hold the order in PARTS_PENDING and ask inventory to reserve stock. */
    requestParts(id, lines) {
      return mutate(id, async (client, order) => {
        assertTransition(order, S.PARTS_PENDING);
        const merged = mergeLines(lines);
        const requestId = randomUUID();
        for (const line of merged) {
          await client.query(
            'insert into part_line (id, repair_order_id, request_id, sku, quantity, status) values ($1,$2,$3,$4,$5,$6)',
            [randomUUID(), id, requestId, line.sku, line.quantity, PartLineStatus.REQUESTED]);
        }
        await client.query('update repair_order set status = $2, version = version + 1 where id = $1', [id, S.PARTS_PENDING]);
        await publish(client, order, EventTypes.PARTS_RESERVATION_REQUESTED,
          { requestId, repairOrderId: id, dealerId: order.dealer_id, lines: merged });
      });
    },

    async onPartsReserved(client, e) {
      const order = (await client.query('select * from repair_order where id = $1 for update', [e.repairOrderId])).rows[0];
      if (!order || (await pendingLines(client, order, e.requestId)).length === 0) {
        logger.info({ repairOrderId: e.repairOrderId }, 'Ignoring stale PartsReserved');
        return;
      }
      for (const line of e.lines) {
        await client.query(
          `update part_line set status = $4, name = $5, unit_price = $6
           where repair_order_id = $1 and request_id = $2 and sku = $3`,
          [order.id, e.requestId, line.sku, PartLineStatus.RESERVED, line.name, line.unitPrice]);
      }
      await client.query('update repair_order set status = $2, note = null, version = version + 1 where id = $1',
        [order.id, S.IN_PROGRESS]);
    },

    async onPartsReservationFailed(client, e) {
      const order = (await client.query('select * from repair_order where id = $1 for update', [e.repairOrderId])).rows[0];
      if (!order || (await pendingLines(client, order, e.requestId)).length === 0) {
        logger.info({ repairOrderId: e.repairOrderId }, 'Ignoring stale PartsReservationFailed');
        return;
      }
      await client.query('update part_line set status = $3 where repair_order_id = $1 and request_id = $2',
        [order.id, e.requestId, PartLineStatus.REJECTED]);
      await client.query('update repair_order set status = $2, note = $3, version = version + 1 where id = $1',
        [order.id, S.IN_PROGRESS, `Parts request rejected: ${e.reason}`]);
    },

    complete(id) {
      return mutate(id, async (client, order) => {
        assertTransition(order, S.COMPLETED);
        const lines = (await linesOf(client, id)).map((l) => ({ ...l, unitPricePaise: toPaise(l.unit_price) ?? 0 }));
        const invoice = computeInvoice(toPaise(order.labour_amount), lines);
        await client.query(
          `update repair_order set status = $2, parts_amount = $3, tax_amount = $4, total_amount = $5,
             closed_at = now(), version = version + 1 where id = $1`,
          [id, S.COMPLETED, formatRupees(invoice.partsPaise), formatRupees(invoice.taxPaise), formatRupees(invoice.totalPaise)]);
        await publish(client, order, EventTypes.REPAIR_ORDER_COMPLETED, {
          repairOrderId: id, roNumber: order.ro_number, dealerId: order.dealer_id, customerName: order.customer_name,
          customerPhone: order.customer_phone, vehicleNumber: order.vehicle_number, totalAmount: toRupees(invoice.totalPaise),
        });
      });
    },

    /** Compensation: inventory releases whatever it reserved for this order. */
    cancel(id, reason) {
      return mutate(id, async (client, order) => {
        assertTransition(order, S.CANCELLED);
        await client.query('update repair_order set status = $2, note = $3, closed_at = now(), version = version + 1 where id = $1',
          [id, S.CANCELLED, reason]);
        await publish(client, order, EventTypes.REPAIR_ORDER_CANCELLED, { repairOrderId: id, dealerId: order.dealer_id, reason });
      });
    },
  };
}
