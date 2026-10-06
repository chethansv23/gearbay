import { randomUUID } from 'node:crypto';
import {
  AggregateTypes, ApiError, EventTypes, SqlStates, Topics, appendOutbox, durationMinutes, hasSqlState, supports,
  withTransaction,
} from '@gearbay/common';
import { DateTime } from 'luxon';
import {
  AppointmentErrorCodes, AppointmentStatus, BAY_LOCK_NAMESPACE, Constraints,
} from './constants/index.js';
import { appointmentView } from './dto/views.js';
import * as repo from './repository.js';
import { computeSlots, isOnGrid, minutesOfDay } from './slotGrid.js';

export function createAppointmentService({ pool, cache, logger, clock = () => new Date() }) {

  async function dealer(dealerId) {
    const found = await repo.findDealer(pool, dealerId);
    if (!found) throw ApiError.notFound('Dealer', dealerId);
    return found;
  }

  function dayBounds(date, zone) {
    const start = DateTime.fromISO(date, { zone }).startOf('day');
    return [start.toJSDate(), start.plus({ days: 1 }).toJSDate()];
  }

  function busyIntervals(d, date) {
    return cache.get(d.id, date, () => repo.findBusyIntervals(pool, d.id, ...dayBounds(date, d.timezone)));
  }

  function jobMinutes(serviceType, vehicleType) {
    if (!supports(serviceType, vehicleType)) {
      throw ApiError.badRequest(AppointmentErrorCodes.SERVICE_NOT_OFFERED, `${serviceType} is not offered for a ${vehicleType}`);
    }
    return durationMinutes(serviceType, vehicleType);
  }

  function validateSlot(d, slotStart, minutes) {
    const start = DateTime.fromISO(slotStart, { zone: d.timezone });
    if (!isOnGrid(start)) {
      throw ApiError.badRequest(AppointmentErrorCodes.OFF_GRID, 'Slots start on the hour or half hour');
    }
    const end = start.plus({ minutes });
    const startOfDay = start.hour * 60 + start.minute;
    if (startOfDay < minutesOfDay(d.open_time) || !end.hasSame(start, 'day')
        || end.hour * 60 + end.minute > minutesOfDay(d.close_time)) {
      throw ApiError.badRequest(AppointmentErrorCodes.OUTSIDE_HOURS,
        `${d.name} is open ${d.open_time.slice(0, 5)}-${d.close_time.slice(0, 5)} and this job takes ${minutes} minutes`);
    }
    if (start.toJSDate() < clock()) {
      throw ApiError.badRequest(AppointmentErrorCodes.SLOT_IN_PAST, 'Cannot book a slot in the past');
    }
    return { start: start.toJSDate(), end: end.toJSDate(), date: start.toISODate() };
  }

  /**
   * The per-bay advisory lock is what makes the exclusion constraint safe under contention. Without it,
   * two transactions inserting overlapping rows for the same bay at the same moment each wait on the
   * other's uncommitted row while checking the constraint, and Postgres aborts one with a deadlock.
   * With it, inserts for one bay queue up and each one after the winner fails fast with a clean
   * exclusion violation. Each transaction holds at most one such lock, so no cycle can form.
   */
  function insertOnBay(bay, request, slot, idempotencyKey) {
    return withTransaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock($1, $2)', [BAY_LOCK_NAMESPACE, bay.id]);
      const row = await repo.insertAppointment(client, {
        id: randomUUID(),
        dealerId: bay.dealer_id,
        bayId: bay.id,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        customerEmail: request.customerEmail ?? null,
        vehicleType: request.vehicleType,
        vehicleNumber: request.vehicleNumber.replaceAll(' ', '').toUpperCase(),
        vehicleMake: request.vehicleMake ?? null,
        vehicleModel: request.vehicleModel ?? null,
        serviceType: request.serviceType,
        slotStart: slot.start,
        slotEnd: slot.end,
        status: AppointmentStatus.BOOKED,
        idempotencyKey: idempotencyKey ?? null,
        notes: request.notes ?? null,
      });
      await appendOutbox(client, {
        topic: Topics.APPOINTMENT_EVENTS, aggregateType: AggregateTypes.APPOINTMENT, aggregateId: row.id,
        eventType: EventTypes.APPOINTMENT_BOOKED,
        payload: {
          appointmentId: row.id, dealerId: row.dealer_id, customerName: row.customer_name,
          customerPhone: row.customer_phone, vehicleType: row.vehicle_type, vehicleNumber: row.vehicle_number,
          serviceType: row.service_type, slotStart: row.slot_start, slotEnd: row.slot_end,
        },
      });
      return row;
    });
  }

  async function replay(existing) {
    const d = await repo.findDealer(pool, existing.dealer_id);
    return { appointment: appointmentView(existing, d.timezone), replayed: true };
  }

  async function changeStatus(id, apply) {
    const updated = await withTransaction(pool, async (client) => {
      const row = await repo.findById(client, id, { forUpdate: true });
      if (!row) throw ApiError.notFound('Appointment', id);
      return apply(client, row);
    });
    const d = await repo.findDealer(pool, updated.dealer_id);
    await cache.evict(d.id, DateTime.fromJSDate(updated.slot_start, { zone: d.timezone }).toISODate());
    return appointmentView(updated, d.timezone);
  }

  function requireBooked(row, action) {
    if (row.status !== AppointmentStatus.BOOKED) {
      throw ApiError.conflict(AppointmentErrorCodes.INVALID_STATE, `Cannot ${action} an appointment that is ${row.status}`);
    }
  }

  return {
    async availability({ dealerId, vehicleType, serviceType, date }) {
      const minutes = jobMinutes(serviceType, vehicleType);
      const d = await dealer(dealerId);
      const bayIds = (await repo.findBays(pool, dealerId, vehicleType)).map((b) => b.id);
      const slots = computeSlots({
        date, zone: d.timezone, openTime: d.open_time, closeTime: d.close_time, durationMinutes: minutes,
        bayIds, busy: await busyIntervals(d, date), now: clock(),
      });
      return { dealerId, date, vehicleType, serviceType, durationMinutes: minutes, slots };
    },

    /**
     * Books the first free bay of the right vehicle type. The database, not this function, decides
     * conflicts: an exclusion constraint rejects overlapping bookings on the same bay, so two concurrent
     * requests for the last free bay cannot both win, even across service instances.
     */
    async book(request, idempotencyKey) {
      if (idempotencyKey) {
        const existing = await repo.findByIdempotencyKey(pool, idempotencyKey);
        if (existing) return replay(existing);
      }
      const minutes = jobMinutes(request.serviceType, request.vehicleType);
      const d = await dealer(request.dealerId);
      const slot = validateSlot(d, request.slotStart, minutes);

      const candidates = await repo.findBays(pool, d.id, request.vehicleType);
      if (candidates.length === 0) {
        throw ApiError.badRequest(AppointmentErrorCodes.NO_BAYS, `${d.name} has no ${request.vehicleType} bays`);
      }
      // Try bays that look free first; the constraint still guards against races.
      const busyBays = new Set((await busyIntervals(d, slot.date))
        .filter((b) => b.start < slot.end && slot.start < b.end).map((b) => b.bayId));
      const ordered = [...candidates].sort((a, b) => Number(busyBays.has(a.id)) - Number(busyBays.has(b.id)));

      for (const bay of ordered) {
        try {
          const row = await insertOnBay(bay, request, slot, idempotencyKey);
          await cache.evict(d.id, slot.date);
          logger.info({ appointmentId: row.id, bay: bay.name }, 'Booked appointment');
          return { appointment: appointmentView(row, d.timezone), replayed: false };
        } catch (error) {
          if (hasSqlState(error, SqlStates.EXCLUSION_VIOLATION)) continue; // bay taken: try the next one
          if (idempotencyKey && hasSqlState(error, SqlStates.UNIQUE_VIOLATION)
              && error.constraint === Constraints.IDEMPOTENCY_KEY) {
            return replay(await repo.findByIdempotencyKey(pool, idempotencyKey)); // a concurrent retry won
          }
          throw error;
        }
      }
      throw ApiError.conflict(AppointmentErrorCodes.SLOT_UNAVAILABLE,
        `No ${request.vehicleType} bay is free at ${request.slotStart} for ${request.serviceType}`);
    },

    async get(id) {
      const row = await repo.findById(pool, id);
      if (!row) throw ApiError.notFound('Appointment', id);
      const d = await repo.findDealer(pool, row.dealer_id);
      return appointmentView(row, d.timezone);
    },

    async forDay(dealerId, date) {
      const d = await dealer(dealerId);
      const rows = await repo.findForDay(pool, dealerId, ...dayBounds(date, d.timezone));
      return rows.map((r) => appointmentView(r, d.timezone));
    },

    checkIn(id, odometerKm) {
      return changeStatus(id, async (client, row) => {
        requireBooked(row, 'check in');
        const updated = await repo.updateStatus(client, id, { status: AppointmentStatus.CHECKED_IN, odometerKm });
        await appendOutbox(client, {
          topic: Topics.APPOINTMENT_EVENTS, aggregateType: AggregateTypes.APPOINTMENT, aggregateId: id,
          eventType: EventTypes.APPOINTMENT_CHECKED_IN,
          payload: {
            appointmentId: id, dealerId: row.dealer_id, customerName: row.customer_name, customerPhone: row.customer_phone,
            vehicleType: row.vehicle_type, vehicleNumber: row.vehicle_number, vehicleMake: row.vehicle_make,
            vehicleModel: row.vehicle_model, serviceType: row.service_type, odometerKm: odometerKm ?? null,
          },
        });
        return updated;
      });
    },

    cancel(id, reason) {
      return changeStatus(id, async (client, row) => {
        requireBooked(row, 'cancel');
        const updated = await repo.updateStatus(client, id, { status: AppointmentStatus.CANCELLED, cancelReason: reason });
        await appendOutbox(client, {
          topic: Topics.APPOINTMENT_EVENTS, aggregateType: AggregateTypes.APPOINTMENT, aggregateId: id,
          eventType: EventTypes.APPOINTMENT_CANCELLED,
          payload: {
            appointmentId: id, dealerId: row.dealer_id, customerName: row.customer_name,
            customerPhone: row.customer_phone, slotStart: row.slot_start, reason,
          },
        });
        return updated;
      });
    },
  };
}
