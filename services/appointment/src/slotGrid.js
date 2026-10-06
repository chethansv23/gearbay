import { DateTime } from 'luxon';
import { SLOT_STEP_MINUTES } from './constants/index.js';

/** "09:30:00" → 570 */
export const minutesOfDay = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** 570 → "09:30:00" */
export const timeOfDay = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;

export const isOnGrid = (dateTime) =>
  dateTime.second === 0 && dateTime.millisecond === 0 && dateTime.minute % SLOT_STEP_MINUTES === 0;

const overlaps = (busy, start, end) => busy.start < end && start < busy.end;

/**
 * Pure availability calculation on the 30-minute grid, kept free of the database so the rules are
 * easy to unit test.
 *
 * @param bayIds bays able to take this vehicle type
 * @param busy   everything already booked at the dealer that day: { bayId, start: Date, end: Date }
 * @param now    slots starting before this instant are not offered
 */
export function computeSlots({ date, zone, openTime, closeTime, durationMinutes, bayIds, busy, now }) {
  const open = minutesOfDay(openTime);
  const close = minutesOfDay(closeTime);
  const slots = [];
  for (let offset = open; offset + durationMinutes <= close; offset += SLOT_STEP_MINUTES) {
    const start = DateTime.fromISO(`${date}T${timeOfDay(offset)}`, { zone }).toJSDate();
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    if (start < now) continue;
    const freeBays = bayIds.filter((bay) => !busy.some((b) => b.bayId === bay && overlaps(b, start, end))).length;
    slots.push({ start: timeOfDay(offset), end: timeOfDay(offset + durationMinutes), freeBays });
  }
  return slots;
}
