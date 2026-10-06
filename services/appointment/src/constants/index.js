export const SERVICE_NAME = 'appointment-service';
export const DATABASE = 'appointment_db';
export const DEFAULT_PORT = 9081;

/** Booking grid: slots start on the hour or half hour. */
export const SLOT_STEP_MINUTES = 30;

/** Namespace for `pg_advisory_xact_lock(namespace, bayId)` so these locks cannot collide with others. */
export const BAY_LOCK_NAMESPACE = 7001;

/** Constraint names the service reacts to. */
export const Constraints = Object.freeze({
  BAY_OVERLAP: 'ex_appointment_bay_overlap',
  IDEMPOTENCY_KEY: 'uk_appointment_idempotency_key',
});

/** Redis key prefix for a dealer's booked intervals on one day: `<prefix><dealerId>:<date>`. */
export const BUSY_SLOTS_CACHE_KEY_PREFIX = 'gearbay:busy:';
export const BUSY_SLOTS_TTL_SECONDS = 60;

export const AppointmentStatus = Object.freeze({
  BOOKED: 'BOOKED',
  CHECKED_IN: 'CHECKED_IN',
  CANCELLED: 'CANCELLED',
});

/** Stable error codes returned by the appointment API. */
export const AppointmentErrorCodes = Object.freeze({
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  OFF_GRID: 'OFF_GRID',
  OUTSIDE_HOURS: 'OUTSIDE_HOURS',
  SLOT_IN_PAST: 'SLOT_IN_PAST',
  SERVICE_NOT_OFFERED: 'SERVICE_NOT_OFFERED',
  NO_BAYS: 'NO_BAYS',
  INVALID_STATE: 'INVALID_STATE',
});

/** Local date-time format used in requests and responses, e.g. 2026-09-28T10:00:00 */
export const LOCAL_DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss";
