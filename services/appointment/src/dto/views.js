import { DateTime } from 'luxon';
import { LOCAL_DATE_TIME_FORMAT } from '../constants/index.js';

const local = (date, zone) => DateTime.fromJSDate(date, { zone }).toFormat(LOCAL_DATE_TIME_FORMAT);

export function appointmentView(row, zone) {
  return {
    id: row.id,
    dealerId: row.dealer_id,
    bayId: row.bay_id,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    vehicleType: row.vehicle_type,
    vehicleNumber: row.vehicle_number,
    vehicleMake: row.vehicle_make,
    vehicleModel: row.vehicle_model,
    serviceTypes: row.service_types,
    localStart: local(row.slot_start, zone),
    localEnd: local(row.slot_end, zone),
    slotStart: row.slot_start.toISOString(),
    slotEnd: row.slot_end.toISOString(),
    notes: row.notes,
    odometerKm: row.odometer_km,
    cancelReason: row.cancel_reason,
  };
}

export function dealerView(row, bayCount) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    timezone: row.timezone,
    openTime: row.open_time,
    closeTime: row.close_time,
    bayCount,
  };
}

export const bayView = (row) => ({ id: row.id, name: row.name, vehicleType: row.vehicle_type });
