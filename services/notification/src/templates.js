import { DateTime } from 'luxon';
import { DISPLAY_ZONE, MESSAGE_DATE_TIME_FORMAT } from './constants/index.js';

const when = (instant) => DateTime.fromISO(instant, { zone: DISPLAY_ZONE }).toFormat(MESSAGE_DATE_TIME_FORMAT, { locale: 'en-US' });
const human = (code) => code.replaceAll('_', ' ').toLowerCase();
const shortRef = (id) => id.slice(0, 8).toUpperCase();

/** Customer-facing copy. */
export const templates = {
  booked: (e) => `Hi ${e.customerName}, your ${e.vehicleType.toLowerCase()} ${e.vehicleNumber} for ${human(e.serviceType)} `
    + `is confirmed for ${when(e.slotStart)}. Ref ${shortRef(e.appointmentId)}.`,
  cancelled: (e) => `Hi ${e.customerName}, your service appointment on ${when(e.slotStart)} has been cancelled (${e.reason}).`,
  checkedIn: (e) => `Hi ${e.customerName}, we have received ${e.vehicleNumber}. We'll message you when the job card is open.`,
  roCreated: (e) => `Job card ${e.roNumber} opened for ${e.vehicleNumber}. Track progress with this number.`,
  roCompleted: (e) => `Good news ${e.customerName}! ${e.vehicleNumber} is ready for pickup. `
    + `Invoice ${e.roNumber} total Rs ${Number(e.totalAmount).toFixed(2)} (incl. GST).`,
  lowStock: (e) => `Low stock at ${e.dealerId}: ${e.name} (${e.sku}) has ${e.available} available, reorder level ${e.reorderLevel}.`,
};
