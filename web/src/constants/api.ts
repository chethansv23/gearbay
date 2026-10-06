/** Every API call goes through this prefix; Vite (dev) and nginx (Docker) proxy it to the gateway. */
export const API_BASE_URL = '/api';

/** Sent with bookings so a retried request returns the original booking instead of creating a second one. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Error codes from the API that the UI reacts to. */
export const API_ERROR_CODES = {
  /** Another customer took the last bay for the chosen slot. */
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
} as const;

/**
 * Labels the user sees for API field names, so validation errors read "Mobile must be…" rather than
 * "customerPhone must be…". Fields not listed here are shown by their API name.
 */
export const FIELD_LABELS: Record<string, string> = {
  customerName: 'Name',
  customerPhone: 'Mobile',
  customerEmail: 'Email',
  vehicleNumber: 'Registration number',
  vehicleMake: 'Make',
  vehicleModel: 'Model',
  notes: 'Notes',
  slotStart: 'Time slot',
  odometerKm: 'Odometer',
  reason: 'Reason',
  technician: 'Technician',
  lines: 'Parts',
  quantity: 'Quantity',
};

/** How many sent messages the activity feed shows. */
export const NOTIFICATIONS_LIMIT = 40;
